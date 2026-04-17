import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Proxy to OpenSea v2 API for Monad collections.
 *
 * Requires OPENSEA_API_KEY env var (free: https://docs.opensea.io/reference/api-keys).
 * Server-only — key never leaks to browser.
 *
 * Returns a normalized shape the UI can render directly:
 *   { collections: [{ slug, name, image, banner, floorMon, oneDayVolumeMon, totalSupply, description }], fetchedAt }
 *
 * In-memory cached for 60s per query to minimize upstream calls.
 */

const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const CHAIN = "monad"; // OpenSea slug for Monad mainnet
const CACHE_TTL_MS = 60_000;

type Normalized = {
  slug: string;
  name: string;
  image: string | null;
  banner: string | null;
  description: string | null;
  floorMon: number | null;
  oneDayVolumeMon: number | null;
  totalSupply: number | null;
  owners: number | null;
  openseaUrl: string;
};

type CacheBlob = { ts: number; data: Normalized[] };
const cache = new Map<string, CacheBlob>();

const LIMIT_RE = /^[0-9]{1,3}$/;

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(ip, { bucket: "opensea-collections", max: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "missing_api_key",
        message:
          "OpenSea API key not configured. Set OPENSEA_API_KEY env var in Vercel dashboard. Get a free key at https://docs.opensea.io/reference/api-keys",
      },
      { status: 503 }
    );
  }

  // Validated query params
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit") ?? "30";
  const limit = LIMIT_RE.test(limitRaw) ? Math.min(100, Math.max(1, parseInt(limitRaw, 10))) : 30;
  const orderBy = url.searchParams.get("order_by") === "created_date" ? "created_date" : "market_cap";

  const cacheKey = `${CHAIN}:${limit}:${orderBy}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { collections: hit.data, fetchedAt: hit.ts, cached: true },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  }

  try {
    // 1) List collections on Monad
    const listRes = await fetch(
      `${OPENSEA_BASE}/collections?chain=${CHAIN}&limit=${limit}&order_by=${orderBy}`,
      {
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
        cache: "no-store",
      }
    );

    if (!listRes.ok) {
      // Surface stale cache if we have any
      if (hit) {
        return NextResponse.json(
          { collections: hit.data, fetchedAt: hit.ts, cached: true, stale: true },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: "upstream_error", status: listRes.status, message: await listRes.text().catch(() => "") },
        { status: 502 }
      );
    }

    const listJson = (await listRes.json()) as {
      collections?: Array<{
        collection: string;
        name: string;
        description?: string;
        image_url?: string;
        banner_image_url?: string;
        owner?: string;
        total_supply?: number;
      }>;
    };

    const slugs = (listJson.collections ?? []).map((c) => c.collection).filter(Boolean);

    // 2) Fetch stats for each collection in parallel (capped)
    const statsSettled = await Promise.allSettled(
      slugs.map((slug) =>
        fetch(`${OPENSEA_BASE}/collections/${encodeURIComponent(slug)}/stats`, {
          headers: { "X-API-KEY": apiKey, Accept: "application/json" },
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : null))
      )
    );

    // 3) Normalize
    const normalized: Normalized[] = (listJson.collections ?? []).map((c, i) => {
      const statsRes = statsSettled[i];
      const stats =
        statsRes && statsRes.status === "fulfilled" ? (statsRes.value as Record<string, unknown> | null) : null;

      const total = (stats?.total as Record<string, unknown> | undefined) ?? {};
      const intervals = (stats?.intervals as Array<Record<string, unknown>> | undefined) ?? [];
      const oneDay = intervals.find((x) => x.interval === "one_day") ?? {};

      const floorMon = typeof total.floor_price === "number" ? (total.floor_price as number) : null;
      const oneDayVolumeMon = typeof oneDay.volume === "number" ? (oneDay.volume as number) : null;
      const owners = typeof total.num_owners === "number" ? (total.num_owners as number) : null;

      return {
        slug: c.collection,
        name: c.name ?? c.collection,
        image: c.image_url ?? null,
        banner: c.banner_image_url ?? null,
        description: c.description ?? null,
        floorMon,
        oneDayVolumeMon,
        totalSupply: typeof c.total_supply === "number" ? c.total_supply : null,
        owners,
        openseaUrl: `https://opensea.io/collection/${c.collection}`,
      };
    });

    cache.set(cacheKey, { ts: now, data: normalized });
    return NextResponse.json(
      { collections: normalized, fetchedAt: now, cached: false },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch (e) {
    if (hit) {
      return NextResponse.json(
        { collections: hit.data, fetchedAt: hit.ts, cached: true, stale: true },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: "upstream_error", message: String(e) }, { status: 502 });
  }
}
