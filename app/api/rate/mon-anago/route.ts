import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Live MON -> ANAGO exchange rate via Relay.
 *
 * Returns { anagoPerMon: number, cachedAt: number }.
 * Cached in-memory for 45s to minimize upstream calls.
 *
 * The Relay quote endpoint needs valid user/recipient addresses even for
 * price discovery; we pass a known "dead" address that has no role in the
 * actual settlement — this is purely a read-only quote.
 */

const RELAY_BASE = "https://api.relay.link";
const MONAD_CHAIN_ID = 143;
const NATIVE = "0x0000000000000000000000000000000000000000";
const ANAGO = "0x5dF178C7E58046BC9074782fef0009C6Be167777";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const ONE_MON_WEI = "1000000000000000000"; // 1e18

type CacheEntry = { ts: number; anagoPerMon: number } | null;
let cache: CacheEntry = null;
const TTL_MS = 45_000;

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(ip, { bucket: "rate-mon-anago", max: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) {
    return NextResponse.json(
      { anagoPerMon: cache.anagoPerMon, cachedAt: cache.ts, cached: true },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  }

  try {
    const res = await fetch(`${RELAY_BASE}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        originChainId: MONAD_CHAIN_ID,
        destinationChainId: MONAD_CHAIN_ID,
        originCurrency: NATIVE,
        destinationCurrency: ANAGO,
        amount: ONE_MON_WEI,
        user: DEAD,
        recipient: DEAD,
        tradeType: "EXACT_INPUT",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      // Fall back to stale cache if available
      if (cache) {
        return NextResponse.json(
          { anagoPerMon: cache.anagoPerMon, cachedAt: cache.ts, cached: true, stale: true },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: "upstream_error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const amountFormatted = data?.details?.currencyOut?.amountFormatted;
    const amountWei = data?.details?.currencyOut?.amount;

    let anagoPerMon: number | null = null;
    if (amountFormatted && !Number.isNaN(Number(amountFormatted))) {
      anagoPerMon = Number(amountFormatted);
    } else if (amountWei) {
      anagoPerMon = Number(amountWei) / 1e18;
    }

    if (!anagoPerMon || !Number.isFinite(anagoPerMon) || anagoPerMon <= 0) {
      if (cache) {
        return NextResponse.json(
          { anagoPerMon: cache.anagoPerMon, cachedAt: cache.ts, cached: true, stale: true },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: "invalid_rate" }, { status: 502 });
    }

    cache = { ts: now, anagoPerMon };
    return NextResponse.json(
      { anagoPerMon, cachedAt: now, cached: false },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch {
    if (cache) {
      return NextResponse.json(
        { anagoPerMon: cache.anagoPerMon, cachedAt: cache.ts, cached: true, stale: true },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
