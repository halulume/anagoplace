import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Broad Monad NFT feed for the Explore page.
 *
 * Strategy: fetch top-N collections by market_cap, then pull NFTs from each
 * via /collection/{slug}/nfts (which already includes name+image inline, no
 * per-token enrichment needed). Returns a flat list capped at `limit`.
 *
 * Price is intentionally omitted — for pricing, the client can cross-reference
 * /api/opensea/trending or call the individual NFT endpoint.
 */

const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const CACHE_TTL_MS = 60_000;
const TOP_COLLECTIONS = 12;
const PER_COLLECTION = 20;

export type ExploreNFT = {
  tokenId: string;
  tokenName: string;
  image: string | null;
  collection: string;
  collectionName: string;
  contract: string;
  openseaUrl: string;
};

type CacheBlob = { ts: number; data: ExploreNFT[] };
const cache = new Map<string, CacheBlob>();

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(ip, { bucket: "opensea-explore", max: 40, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const cacheKey = `explore:${limit}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { nfts: hit.data.slice(0, limit), fetchedAt: hit.ts, cached: true },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  }

  try {
    // 1) Top collections by market_cap
    const listRes = await fetch(
      `${OPENSEA_BASE}/collections?chain=monad&limit=${TOP_COLLECTIONS}&order_by=market_cap`,
      { headers: { "X-API-KEY": apiKey, Accept: "application/json" }, cache: "no-store" }
    );
    if (!listRes.ok) {
      if (hit) {
        return NextResponse.json(
          { nfts: hit.data.slice(0, limit), fetchedAt: hit.ts, cached: true, stale: true },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: "upstream_error", status: listRes.status }, { status: 502 });
    }
    const listJson = (await listRes.json()) as {
      collections?: Array<{ collection: string; name: string }>;
    };
    const slugs = (listJson.collections ?? []).map((c) => ({
      slug: c.collection,
      name: c.name ?? c.collection,
    }));

    // 2) Fetch NFTs per collection in parallel (inline metadata, no enrichment)
    const settled = await Promise.allSettled(
      slugs.map(({ slug }) =>
        fetch(
          `${OPENSEA_BASE}/collection/${encodeURIComponent(slug)}/nfts?limit=${PER_COLLECTION}`,
          { headers: { "X-API-KEY": apiKey, Accept: "application/json" }, cache: "no-store" }
        ).then((r) => (r.ok ? r.json() : null))
      )
    );

    // 3) Flatten
    const all: ExploreNFT[] = [];
    settled.forEach((res, i) => {
      if (res.status !== "fulfilled" || !res.value) return;
      const nfts = (res.value as { nfts?: Array<Record<string, unknown>> }).nfts ?? [];
      for (const n of nfts) {
        const identifier = (n.identifier as string) ?? "";
        const contract = (n.contract as string) ?? "";
        if (!identifier || !contract) continue;
        all.push({
          tokenId: identifier,
          tokenName: (n.name as string) ?? `#${identifier}`,
          image:
            (n.display_image_url as string) ??
            (n.image_url as string) ??
            null,
          collection: slugs[i].slug,
          collectionName: slugs[i].name,
          contract,
          openseaUrl:
            (n.opensea_url as string) ??
            `https://opensea.io/assets/monad/${contract}/${identifier}`,
        });
      }
    });

    cache.set(cacheKey, { ts: now, data: all });
    return NextResponse.json(
      { nfts: all.slice(0, limit), fetchedAt: now, cached: false },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch (e) {
    if (hit) {
      return NextResponse.json(
        { nfts: hit.data.slice(0, limit), fetchedAt: hit.ts, cached: true, stale: true },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: "upstream_error", message: String(e) }, { status: 502 });
  }
}
