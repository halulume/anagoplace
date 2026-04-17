import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const RELAY_BASE = "https://api.relay.link";

/**
 * Proxy for Relay's /execute/swap endpoint.
 * We only forward the request — all transaction signing happens in the user's wallet,
 * so the proxy never holds or signs anything sensitive.
 */

function withRateLimit(req: NextRequest): NextResponse | null {
  const ip = clientIp(req.headers);
  const rl = rateLimit(ip, { bucket: "relay-execute", max: 15, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many execute requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const limited = withRateLimit(req);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  // Only allow known-safe query keys
  const allowed = new Set(["requestId", "chainId", "txHash"]);
  const params = new URLSearchParams();
  searchParams.forEach((v, k) => {
    if (allowed.has(k) && v.length < 200) params.set(k, v);
  });

  try {
    const res = await fetch(`${RELAY_BASE}/execute/swap?${params.toString()}`, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const limited = withRateLimit(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Basic sanity — reject oversized payloads
  const serialized = JSON.stringify(body);
  if (serialized.length > 50_000) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  try {
    const res = await fetch(`${RELAY_BASE}/execute/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: serialized,
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
