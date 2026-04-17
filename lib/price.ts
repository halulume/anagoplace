// Real-time MON/USD price via CoinGecko (free, no API key needed)
// ANAGO price derived from on-chain router when pool exists

import { useState, useEffect, useCallback } from "react";

const COINGECKO_MON_ID = "monad"; // CoinGecko ID for Monad
const CACHE_TTL = 30_000; // 30 seconds

let _cachedPrice: number | null = null;
let _lastFetch = 0;

export async function fetchMonPrice(): Promise<number | null> {
  const now = Date.now();
  if (_cachedPrice !== null && now - _lastFetch < CACHE_TTL) {
    return _cachedPrice;
  }
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_MON_ID}&vs_currencies=usd`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    const price = data?.[COINGECKO_MON_ID]?.usd ?? null;
    if (price) {
      _cachedPrice = price;
      _lastFetch = now;
    }
    return price;
  } catch {
    return _cachedPrice; // return stale cache on error
  }
}

export function useMonPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await fetchMonPrice();
    setPrice(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Convert ANAGO amount to USD (requires ANAGO/MON rate from router)
  // When no pool: returns null
  const anagoToUsd = (anagoAmount: number, anagoPerMon: number | null): number | null => {
    if (!price || !anagoPerMon || anagoPerMon === 0) return null;
    const monAmount = anagoAmount / anagoPerMon;
    return monAmount * price;
  };

  const monToUsd = (monAmount: number): number | null => {
    if (!price) return null;
    return monAmount * price;
  };

  return { price, loading, refresh, anagoToUsd, monToUsd };
}

// Format USD price
export function formatUsd(usd: number | null): string {
  if (usd === null) return "";
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
