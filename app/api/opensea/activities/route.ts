import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Proxy to OpenSea v2 for Monad recent sales across top collections.
 *
 * Strategy: fetch top-N collections by market_cap, then fetch recent sales
 * events per collection in parallel, merge + sort by timestamp desc.
 * Cached for 30s.
 */

const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const CACHE_TTL_MS = 30_000;
const TOP_COLLECTIONS = 12;
const PER_COLLECTION = 3;

type Activity = {
  kind: "sale";
  txHash: string;
  timestamp: number;
  priceMon: number | null;
  paymentSymbol: string;
  buyer: string | null;
  seller: string | null;
  tokenId: string;
  tokenName: string;
  image: string | null;
  collection: string;
  collectionName: string;
  openseaUrl: string;
};

type CacheBlob = { ts: number; data: Activity[] };
const cache = new Map<string, CacheBlob>();

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(ip, { bucket: "opensea-activities", max: 40, windowMs: 60_000 });
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
  const cacheKey = `activities:${limit}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { activities: hit.data.slice(0, limit), fetchedAt: hit.ts, cached: true },
      { headers: { "Cache-Control": "public, max-age=15" } }
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
          { activities: hit.data.slice(0, limit), fetchedAt: hit.ts, cached: true, stale: true },
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

    // 2) Fetch sales per collection in parallel
    const settled = await Promise.allSettled(
      slugs.map(({ slug }) =>
        fetch(
          `${OPENSEA_BASE}/events/collection/${encodeURIComponent(slug)}?event_type=sale&limit=${PER_COLLECTION}`,
          { headers: { "X-API-KEY": apiKey, Accept: "application/json" }, cache: "no-store" }
        ).then((r) => (r.ok ? r.json() : null))
      )
    );

    // 3) Normalize
    const all: Activity[] = [];
    settled.forEach((res, i) => {
      if (res.status !== "fulfilled" || !res.value) return;
      const events = (res.value as { asset_events?: Array<Record<string, unknown>> })
        .asset_events ?? [];
      for (const ev of events) {
        const nft = (ev.nft as Record<string, unknown>) ?? {};
        const payment = (ev.payment as Record<string, unknown>) ?? {};
        const qtyStr = (payment.quantity as string) ?? "0";
        const decimals = (payment.decimals as number) ?? 18;
        const priceNum =
          qtyStr && qtyStr !== "0" ? Number(BigInt(qtyStr)) / Math.pow(10, decimals) : null;
        all.push({
          kind: "sale",
          txHash: (ev.transaction as string) ?? "",
          timestamp: (ev.event_timestamp as number) ?? 0,
          priceMon: priceNum,
          paymentSymbol: ((payment.symbol as string) ?? "MON").toUpperCase(),
          buyer: (ev.buyer as string) ?? null,
          seller: (ev.seller as string) ?? null,
          tokenId: (nft.identifier as string) ?? "",
          tokenName: (nft.name as string) ?? `#${(nft.identifier as string) ?? "?"}`,
          image:
            (nft.display_image_url as string) ??
            (nft.image_url as string) ??
            null,
          collection: slugs[i].slug,
          collectionName: slugs[i].name,
          openseaUrl: (nft.opensea_url as string) ?? `https://opensea.io/collection/${slugs[i].slug}`,
        });
      }
    });

    // 4) Sort desc, cap at 50
    all.sort((a, b) => b.timestamp - a.timestamp);
    const trimmed = all.slice(0, 50);

    cache.set(cacheKey, { ts: now, data: trimmed });
    return NextResponse.json(
      { activities: trimmed.slice(0, limit), fetchedAt: now, cached: false },
      { headers: { "Cache-Control": "public, max-age=15" } }
    );
  } catch (e) {
    if (hit) {
      return NextResponse.json(
        { activities: hit.data.slice(0, limit), fetchedAt: hit.ts, cached: true, stale: true },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: "upstream_error", message: String(e) }, { status: 502 });
  }
}
