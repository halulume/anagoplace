import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const RELAY_BASE = "https://api.relay.link";
const MONAD_CHAIN_ID = 143;
const ANAGO_ADDRESS = "0x5dF178C7E58046BC9074782fef0009C6Be167777".toLowerCase();
const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000".toLowerCase();

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const UINT_RE = /^[0-9]{1,80}$/;

/** Whitelist of currency addresses we allow quoting for (MON native + ANAGO only). */
const ALLOWED_CURRENCIES = new Set([NATIVE_TOKEN, ANAGO_ADDRESS]);

export async function POST(req: NextRequest) {
  // ── Rate limit: 30 quotes / minute / IP
  const ip = clientIp(req.headers);
  const rl = rateLimit(ip, { bucket: "relay-quote", max: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many quote requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // ── Structural validation
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // Only allow Monad <-> Monad swaps in our proxy
  if (b.originChainId !== MONAD_CHAIN_ID || b.destinationChainId !== MONAD_CHAIN_ID) {
    return NextResponse.json({ error: "unsupported_chain" }, { status: 400 });
  }

  const originCurrency = String(b.originCurrency ?? "").toLowerCase();
  const destinationCurrency = String(b.destinationCurrency ?? "").toLowerCase();
  if (!ALLOWED_CURRENCIES.has(originCurrency) || !ALLOWED_CURRENCIES.has(destinationCurrency)) {
    return NextResponse.json({ error: "unsupported_currency" }, { status: 400 });
  }
  if (originCurrency === destinationCurrency) {
    return NextResponse.json({ error: "same_currency" }, { status: 400 });
  }

  // Amount must be a positive integer string (wei)
  const amount = String(b.amount ?? "");
  if (!UINT_RE.test(amount) || amount === "0") {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  // User / recipient must be valid addresses
  const user = String(b.user ?? "");
  const recipient = String(b.recipient ?? "");
  if (!ADDR_RE.test(user) || !ADDR_RE.test(recipient)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  // tradeType must be EXACT_INPUT or EXACT_OUTPUT
  const tradeType = String(b.tradeType ?? "");
  if (tradeType !== "EXACT_INPUT" && tradeType !== "EXACT_OUTPUT") {
    return NextResponse.json({ error: "invalid_trade_type" }, { status: 400 });
  }

  // Forward with only the whitelisted fields — don't pass through unknown client data
  const safeBody: Record<string, unknown> = {
    originChainId: MONAD_CHAIN_ID,
    destinationChainId: MONAD_CHAIN_ID,
    originCurrency,
    destinationCurrency,
    amount,
    user,
    recipient,
    tradeType,
  };
  if (typeof b.slippageTolerance === "string" && /^[0-9.]{1,10}$/.test(b.slippageTolerance)) {
    safeBody.slippageTolerance = b.slippageTolerance;
  }

  try {
    const res = await fetch(`${RELAY_BASE}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(safeBody),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
