"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, TrendingUp, Activity, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

type OsCollection = {
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

type CollectionsResponse = {
  collections: OsCollection[];
  fetchedAt: number;
  cached?: boolean;
  stale?: boolean;
  error?: string;
  message?: string;
};

type RateResponse = {
  anagoPerMon: number;
  cachedAt: number;
  cached?: boolean;
  stale?: boolean;
  error?: string;
};

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n < 1000) return n.toLocaleString("en-US", { maximumFractionDigits: digits });
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "K";
  return (n / 1_000_000).toFixed(1) + "M";
}

function formatAnago(monAmount: number | null, anagoPerMon: number | null): string {
  if (monAmount === null || anagoPerMon === null) return "—";
  return formatNum(monAmount * anagoPerMon);
}

export default function CollectionsPage() {
  const [data, setData] = useState<CollectionsResponse | null>(null);
  const [rate, setRate] = useState<RateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState<"market_cap" | "created_date">("market_cap");
  const [refreshTick, setRefreshTick] = useState(0);

  // Fetch collections + rate in parallel
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [colRes, rateRes] = await Promise.all([
          fetch(`/api/opensea/collections?order_by=${orderBy}&limit=50`, { cache: "no-store" }),
          fetch(`/api/rate/mon-anago`, { cache: "no-store" }),
        ]);

        const colJson: CollectionsResponse = await colRes.json();
        const rateJson: RateResponse = await rateRes.json().catch(() => ({ anagoPerMon: 0, cachedAt: 0 }));

        if (cancelled) return;

        if (!colRes.ok) {
          setError(colJson.message || colJson.error || "Failed to load collections.");
          setData(null);
        } else {
          setData(colJson);
          setError(null);
        }

        if (rateRes.ok && typeof rateJson.anagoPerMon === "number" && rateJson.anagoPerMon > 0) {
          setRate(rateJson);
        } else {
          setRate(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || "Network error.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderBy, refreshTick]);

  // Auto-refresh rate every 45s
  useEffect(() => {
    const id = setInterval(() => {
      fetch(`/api/rate/mon-anago`, { cache: "no-store" })
        .then((r) => r.json())
        .then((json: RateResponse) => {
          if (typeof json.anagoPerMon === "number" && json.anagoPerMon > 0) setRate(json);
        })
        .catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const list = data?.collections ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [data, search]);

  const anagoPerMon = rate?.anagoPerMon ?? null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-white">Discover Collections</h1>
          <p className="text-gray-500 text-sm mt-1">
            Monad NFT collections · live floor prices in ANAGO
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-[#111111] border border-white/[0.05] rounded-xl px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
            <Activity size={12} className={rate ? "text-green-400" : "text-gray-700"} />
            {anagoPerMon ? (
              <>
                <span className="text-gray-500">1 MON =</span>
                <span className="text-white font-semibold">
                  {formatNum(anagoPerMon)} ANAGO
                </span>
              </>
            ) : (
              <span className="text-gray-600">Rate unavailable</span>
            )}
          </div>
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="bg-[#111111] border border-white/[0.05] hover:border-monad-500/25 text-gray-400 hover:text-white rounded-xl p-2 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections..."
            className="w-full bg-[#111111] border border-white/[0.05] focus:border-monad-500/30 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-700 outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setOrderBy("market_cap")}
            className={`text-xs font-semibold px-4 py-2.5 rounded-xl border transition-all ${
              orderBy === "market_cap"
                ? "bg-monad-500/20 border-monad-500/40 text-monad-300"
                : "bg-[#111111] border-white/[0.05] text-gray-500 hover:text-white"
            }`}
          >
            <TrendingUp size={12} className="inline mr-1.5 -mt-0.5" />
            Top
          </button>
          <button
            onClick={() => setOrderBy("created_date")}
            className={`text-xs font-semibold px-4 py-2.5 rounded-xl border transition-all ${
              orderBy === "created_date"
                ? "bg-monad-500/20 border-monad-500/40 text-monad-300"
                : "bg-[#111111] border-white/[0.05] text-gray-500 hover:text-white"
            }`}
          >
            New
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 size={32} className="text-monad-500 animate-spin" />
          <p className="text-gray-600 text-sm">Loading Monad collections...</p>
        </div>
      ) : error ? (
        <div className="bg-[#111111] border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center">
          <AlertCircle size={32} className="text-red-400 mb-3" />
          <p className="text-white font-bold text-base mb-1">Could not load collections</p>
          <p className="text-gray-500 text-sm max-w-md">{error}</p>
        </div>
      ) : !filtered.length ? (
        <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm">No collections match your search.</p>
        </div>
      ) : (
        <CollectionsTable rows={filtered} anagoPerMon={anagoPerMon} />
      )}

      {/* Footer note */}
      <div className="mt-6 text-[11px] text-gray-700 text-center">
        Floor prices from OpenSea, converted to ANAGO via live Relay quote.{" "}
        Buy & sell on AnagoPlace settle in ANAGO.
      </div>
    </div>
  );
}

/* ── Table ────────────────────────────────────────────────────────────── */

function CollectionsTable({
  rows,
  anagoPerMon,
}: {
  rows: OsCollection[];
  anagoPerMon: number | null;
}) {
  return (
    <div className="bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-3 px-4 py-3 border-b border-white/[0.04] text-[10px] font-bold text-gray-600 uppercase tracking-wider">
        <div>#</div>
        <div>Collection</div>
        <div className="text-right">Floor (ANAGO)</div>
        <div className="text-right hidden md:block">Floor (MON)</div>
        <div className="text-right hidden md:block">24h Vol</div>
        <div className="text-right hidden md:block">Supply</div>
        <div></div>
      </div>

      {rows.map((c, idx) => (
        <a
          key={c.slug}
          href={c.openseaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="grid grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-3 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center group"
        >
          <div className="text-gray-600 text-xs font-bold">{idx + 1}</div>

          {/* Name + image */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/[0.05] flex-shrink-0">
              {c.image ? (
                // Using next/image with generic host — CSP must allow it
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image}
                  alt={c.name}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-700 text-[9px]">
                  NFT
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate group-hover:text-monad-300 transition-colors">
                {c.name}
              </p>
              <p className="text-gray-700 text-[10px] font-mono truncate">{c.slug}</p>
            </div>
          </div>

          {/* Floor in ANAGO — primary */}
          <div className="text-right">
            <p className="text-white font-bold text-sm">
              {formatAnago(c.floorMon, anagoPerMon)}
            </p>
            <p className="text-[10px] text-gray-700 uppercase tracking-wide">ANAGO</p>
          </div>

          {/* Floor in MON */}
          <div className="text-right hidden md:block">
            <p className="text-gray-400 text-sm font-medium">{formatNum(c.floorMon)}</p>
            <p className="text-[10px] text-gray-700 uppercase tracking-wide">MON</p>
          </div>

          {/* 24h Volume in MON */}
          <div className="text-right hidden md:block">
            <p className="text-gray-400 text-sm font-medium">
              {formatNum(c.oneDayVolumeMon)}
            </p>
            <p className="text-[10px] text-gray-700 uppercase tracking-wide">MON</p>
          </div>

          {/* Supply */}
          <div className="text-right hidden md:block">
            <p className="text-gray-400 text-sm font-medium">
              {c.totalSupply !== null ? formatNum(c.totalSupply, 0) : "—"}
            </p>
            <p className="text-[10px] text-gray-700 uppercase tracking-wide">items</p>
          </div>

          <div className="text-gray-700 group-hover:text-monad-400 transition-colors">
            <ExternalLink size={14} />
          </div>
        </a>
      ))}
    </div>
  );
}

