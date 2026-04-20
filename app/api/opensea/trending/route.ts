import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Proxy to OpenSea v2 for trending NFT listings across top Monad collections.
 *
 * Strategy: fetch top-N collections, pull their active listings in parallel,
 * pick the most expensive listing per collection (representative flagship),
 * then sort by price desc. Cached for 45s.
 */

const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const CACHE_TTL_MS = 45_000;
const TOP_COLLECTIONS = 15;
const PER_COLLECTION = 6;

type TrendingNFT = {
  tokenId: string;
  tokenName: string;
  image: string | null;
  collection: string;
  collectionName: string;
  priceMon: number | null;
  paymentSymbol: string;
  openseaUrl: string;
  rarity?: string;
};

type CacheBlob = { ts: number; data: TrendingNFT[] };
const cache = new Map<string, CacheBlob>();

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(ip, { bucket: "opensea-trending", max: 40, windowMs: 60_000 });
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
  const limit = Math.min(50, Math.max(5, parseInt(url.searchParams.get("limit") ?? "15", 10) || 15));
  const cacheKey = `trending:${limit}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { nfts: hit.data.slice(0, limit), fetchedAt: hit.ts, cached: true },
      { headers: { "Cache-Control": "public, max-age=20" } }
    );
  }

  try {
    // 1) Top collections
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

    // 2) Fetch active listings per collection in parallel
    const settled = await Promise.allSettled(
      slugs.map(({ slug }) =>
        fetch(
          `${OPENSEA_BASE}/listings/collection/${encodeURIComponent(slug)}/all?limit=${PER_COLLECTION}`,
          { headers: { "X-API-KEY": apiKey, Accept: "application/json" }, cache: "no-store" }
        ).then((r) => (r.ok ? r.json() : null))
      )
    );

    // 3) For each listing, enrich with NFT metadata using /chain/monad/contract/{addr}/nfts/{id}
    const candidates: Array<{
      slug: string;
      slugName: string;
      tokenContract: string;
      tokenId: string;
      priceMon: number | null;
      paymentSymbol: string;
    }> = [];
    settled.forEach((res, i) => {
      if (res.status !== "fulfilled" || !res.value) return;
      const items = (res.value as { listings?: Array<Record<string, unknown>> }).listings ?? [];
      for (const l of items) {
        const proto = l.protocol_data as Record<string, unknown> | undefined;
        const params = proto?.parameters as Record<string, unknown> | undefined;
        const offer = (params?.offer as Array<Record<string, unknown>> | undefined) ?? [];
        const first = offer[0];
        const tokenContract = (first?.token as string) ?? "";
        const tokenId = (first?.identifierOrCriteria as string) ?? "";
        const price = l.price as Record<string, unknown> | undefined;
        const current = price?.current as Record<string, unknown> | undefined;
        const value = (current?.value as string) ?? "0";
        const decimals = (current?.decimals as number) ?? 18;
        const symbol = ((current?.currency as string) ?? "MON").toUpperCase();
        const priceNum = value === "0" ? null : Number(BigInt(value)) / Math.pow(10, decimals);
        if (!tokenContract || !tokenId) continue;
        candidates.push({
          slug: slugs[i].slug,
          slugName: slugs[i].name,
          tokenContract,
          tokenId,
          priceMon: priceNum,
          paymentSymbol: symbol,
        });
      }
    });

    // 4) Pick top PER_COLLECTION most expensive per collection
    const byCollection = new Map<string, typeof candidates>();
    for (const c of candidates) {
      const arr = byCollection.get(c.slug) ?? [];
      arr.push(c);
      byCollection.set(c.slug, arr);
    }
    const picks = Array.from(byCollection.values()).flatMap((arr) =>
      arr
        .filter((x) => typeof x.priceMon === "number" && x.priceMon! > 0)
        .sort((a, b) => (b.priceMon ?? 0) - (a.priceMon ?? 0))
        .slice(0, 2)
    );
    // Sort final by price desc, limit 30
    picks.sort((a, b) => (b.priceMon ?? 0) - (a.priceMon ?? 0));
    const pickLimit = Math.min(30, picks.length);
    const final = picks.slice(0, pickLimit);

    // 5) Enrich with NFT details (image, name) in parallel
    const enriched = await Promise.allSettled(
      final.map((p) =>
        fetch(
          `${OPENSEA_BASE}/chain/monad/contract/${p.tokenContract}/nfts/${p.tokenId}`,
          { headers: { "X-API-KEY": apiKey, Accept: "application/json" }, cache: "no-store" }
        ).then((r) => (r.ok ? r.json() : null))
      )
    );

    const nfts: TrendingNFT[] = final.map((p, i) => {
      const r = enriched[i];
      const meta =
        r.status === "fulfilled" && r.value
          ? ((r.value as Record<string, unknown>).nft as Record<string, unknown> | undefined)
          : undefined;
      return {
        tokenId: p.tokenId,
        tokenName:
          (meta?.name as string) ?? `#${p.tokenId}`,
        image:
          (meta?.display_image_url as string) ??
          (meta?.image_url as string) ??
          null,
        collection: p.slug,
        collectionName: p.slugName,
        priceMon: p.priceMon,
        paymentSymbol: p.paymentSymbol,
        openseaUrl:
          (meta?.opensea_url as string) ??
          `https://opensea.io/assets/monad/${p.tokenContract}/${p.tokenId}`,
      };
    });

    cache.set(cacheKey, { ts: now, data: nfts });
    return NextResponse.json(
      { nfts: nfts.slice(0, limit), fetchedAt: now, cached: false },
      { headers: { "Cache-Control": "public, max-age=20" } }
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
