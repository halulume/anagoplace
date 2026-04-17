"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useReadContract } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/contracts";
import {
  Loader2,
  Search,
  TrendingUp,
  Activity,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Globe,
  LayoutGrid,
  KeyRound,
} from "lucide-react";
import { shortenAddress } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Page                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function CollectionsPage() {
  const [data, setData] = useState<CollectionsResponse | null>(null);
  const [rate, setRate] = useState<RateResponse | null>(null);
  const [loadingOs, setLoadingOs] = useState(true);
  const [osError, setOsError] = useState<string | null>(null);
  const [osMissingKey, setOsMissingKey] = useState(false);
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState<"market_cap" | "created_date">("market_cap");
  const [refreshTick, setRefreshTick] = useState(0);

  // On-chain AnagoPlace collections (always works, no API needed)
  const { data: onchainAddrs, isLoading: loadingOnchain } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllCollections",
  });

  // OpenSea + live rate fetch
  useEffect(() => {
    let cancelled = false;
    setLoadingOs(true);
    setOsError(null);
    setOsMissingKey(false);

    (async () => {
      try {
        const [colRes, rateRes] = await Promise.all([
          fetch(`/api/opensea/collections?order_by=${orderBy}&limit=50`, { cache: "no-store" }),
          fetch(`/api/rate/mon-anago`, { cache: "no-store" }),
        ]);

        const colJson: CollectionsResponse = await colRes.json();
        const rateJson: RateResponse = await rateRes
          .json()
          .catch(() => ({ anagoPerMon: 0, cachedAt: 0 }));

        if (cancelled) return;

        if (!colRes.ok) {
          if (colJson.error === "missing_api_key") {
            setOsMissingKey(true);
            setOsError(null);
          } else {
            setOsError(colJson.message || colJson.error || "Failed to load OpenSea data.");
          }
          setData(null);
        } else {
          setData(colJson);
          setOsError(null);
        }

        if (rateRes.ok && typeof rateJson.anagoPerMon === "number" && rateJson.anagoPerMon > 0) {
          setRate(rateJson);
        }
      } catch (e) {
        if (!cancelled) {
          setOsError((e as Error).message || "Network error.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoadingOs(false);
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

  const filteredOs = useMemo(() => {
    const list = data?.collections ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [data, search]);

  const onchainList = (onchainAddrs as `0x${string}`[] | undefined) ?? [];
  const filteredOnchain = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return onchainList;
    return onchainList.filter((a) => a.toLowerCase().includes(q));
  }, [onchainList, search]);

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
            <Activity size={12} className={rate ? "text-green-400 animate-pulse" : "text-gray-700"} />
            {anagoPerMon ? (
              <>
                <span className="text-gray-500">1 MON =</span>
                <span className="text-white font-semibold">{formatNum(anagoPerMon)} ANAGO</span>
              </>
            ) : (
              <span className="text-gray-600">Rate loading…</span>
            )}
          </div>
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="bg-[#111111] border border-white/[0.05] hover:border-monad-500/25 text-gray-400 hover:text-white rounded-xl p-2 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={loadingOs ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Search + sort */}
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

      {/* ─── Section 1: AnagoPlace on-chain collections ───────────────────── */}
      <SectionHeader
        icon={<LayoutGrid size={14} className="text-monad-400" />}
        title="AnagoPlace Collections"
        subtitle={
          loadingOnchain
            ? "Loading on-chain collections..."
            : `${onchainList.length} collection${onchainList.length === 1 ? "" : "s"} on AnagoPlace · live from Monad`
        }
      />

      {loadingOnchain ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={24} className="text-monad-500 animate-spin" />
        </div>
      ) : filteredOnchain.length === 0 ? (
        <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-10 text-center mb-8">
          <p className="text-gray-500 text-sm mb-3">
            {search ? "No on-chain collections match your search." : "No collections deployed yet."}
          </p>
          {!search && (
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-monad-500 hover:bg-monad-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 text-xs"
            >
              Create First Collection
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
          {filteredOnchain.map((addr) => (
            <OnchainCard key={addr} address={addr} />
          ))}
        </div>
      )}

      {/* ─── Section 2: OpenSea Discover (Monad) ─────────────────────────── */}
      <SectionHeader
        icon={<Globe size={14} className="text-blue-400" />}
        title="Discover on OpenSea · Monad"
        subtitle="Floor prices pulled live from OpenSea, converted to ANAGO"
      />

      {osMissingKey ? (
        <OpenSeaSetupBanner />
      ) : loadingOs && !data ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-monad-500 animate-spin" />
          <p className="text-gray-600 text-xs">Loading from OpenSea...</p>
        </div>
      ) : osError ? (
        <div className="bg-[#111111] border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center mb-8">
          <AlertCircle size={28} className="text-red-400 mb-2" />
          <p className="text-white font-bold text-sm mb-1">Could not load OpenSea data</p>
          <p className="text-gray-500 text-xs max-w-md">{osError}</p>
        </div>
      ) : !filteredOs.length ? (
        <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-10 text-center">
          <p className="text-gray-500 text-sm">
            {search ? "No OpenSea collections match your search." : "No OpenSea data yet for Monad."}
          </p>
        </div>
      ) : (
        <CollectionsTable rows={filteredOs} anagoPerMon={anagoPerMon} />
      )}

      {/* Footer note */}
      <div className="mt-8 text-[11px] text-gray-700 text-center">
        Buy &amp; sell on AnagoPlace settle in{" "}
        <span className="text-monad-400 font-semibold">ANAGO</span> · Live
        MON↔ANAGO rate via Relay
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Components                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="bg-[#111111] border border-white/[0.05] rounded-lg p-1.5">{icon}</div>
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="text-[10px] text-gray-600">{subtitle}</p>
      </div>
    </div>
  );
}

function OnchainCard({ address }: { address: `0x${string}` }) {
  return (
    <Link
      href={`/collection/${address}`}
      className="group bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden hover:border-monad-500/25 hover:shadow-[0_0_20px_rgba(131,110,249,0.08)] transition-all duration-300"
    >
      <div className="relative h-28 bg-gradient-to-br from-monad-950 to-[#0d0d0d] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(131,110,249,0.15)_0%,transparent_70%)]" />
        <Image
          src="/anago-hero.png"
          alt="Collection"
          fill
          className="object-cover opacity-30 group-hover:opacity-50 transition-all duration-300 group-hover:scale-105"
        />
      </div>
      <div className="px-4 -mt-5 mb-3 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border-2 border-[#111111] overflow-hidden ring-1 ring-monad-500/20">
          <Image src="/anago-logo.png" alt="Collection" width={40} height={40} className="object-cover" />
        </div>
      </div>
      <div className="px-4 pb-4">
        <p className="text-white font-bold text-sm truncate">Collection</p>
        <p className="text-gray-700 text-[10px] font-mono truncate mt-0.5">
          {shortenAddress(address)}
        </p>
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[0.04]">
          <div className="text-[10px] text-gray-700 uppercase tracking-wider">Monad Chain</div>
          <div className="flex items-center gap-1 text-[10px] text-monad-500 font-semibold group-hover:text-monad-400 transition-colors">
            View
            <ExternalLink size={10} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function OpenSeaSetupBanner() {
  return (
    <div className="bg-gradient-to-br from-monad-950/60 to-[#0d0d0d] border border-monad-500/20 rounded-2xl p-6 md:p-8 mb-8">
      <div className="flex items-start gap-4">
        <div className="bg-monad-500/15 border border-monad-500/25 rounded-xl p-3 flex-shrink-0">
          <KeyRound size={20} className="text-monad-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-base mb-1">
            OpenSea Discover — API key required
          </h3>
          <p className="text-gray-500 text-xs leading-relaxed mb-4">
            The OpenSea section shows <b>all Monad NFT collections with live floor prices</b>,
            converted to ANAGO using the on-chain MON↔ANAGO pool rate.
            Add a free OpenSea API key to unlock it.
          </p>

          <ol className="space-y-2 text-xs text-gray-400 mb-4">
            <li>
              <span className="text-monad-400 font-bold mr-2">1.</span>Get free key at{" "}
              <a
                href="https://docs.opensea.io/reference/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-monad-400 underline hover:text-monad-300"
              >
                docs.opensea.io/reference/api-keys
              </a>
            </li>
            <li>
              <span className="text-monad-400 font-bold mr-2">2.</span>Vercel dashboard → Settings → Environment Variables
            </li>
            <li>
              <span className="text-monad-400 font-bold mr-2">3.</span>Add{" "}
              <code className="bg-black/40 px-1.5 py-0.5 rounded text-monad-300 font-mono text-[11px]">
                OPENSEA_API_KEY
              </code>{" "}
              with your key → Save
            </li>
            <li>
              <span className="text-monad-400 font-bold mr-2">4.</span>Deployments tab → latest → <b>Redeploy</b>
            </li>
          </ol>

          <div className="flex flex-wrap gap-2">
            <a
              href="https://docs.opensea.io/reference/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-monad-500 hover:bg-monad-400 text-white font-semibold px-3 py-2 rounded-lg transition-all text-xs"
            >
              Get API Key
              <ExternalLink size={11} />
            </a>
            <a
              href="https://vercel.com/halulume/anagoplace/settings/environment-variables"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-white/[0.06] text-white font-semibold px-3 py-2 rounded-lg transition-all text-xs"
            >
              Open Vercel Settings
              <ExternalLink size={11} />
            </a>
          </div>

          <p className="mt-4 text-[10px] text-gray-700">
            Meanwhile, AnagoPlace's on-chain collections (above) are live and fully functional.
          </p>
        </div>
      </div>
    </div>
  );
}

function CollectionsTable({
  rows,
  anagoPerMon,
}: {
  rows: OsCollection[];
  anagoPerMon: number | null;
}) {
  return (
    <div className="bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden">
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
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/[0.05] flex-shrink-0">
              {c.image ? (
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
          <div className="text-right">
            <p className="text-white font-bold text-sm">
              {formatAnago(c.floorMon, anagoPerMon)}
            </p>
            <p className="text-[10px] text-gray-700 uppercase tracking-wide">ANAGO</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-gray-400 text-sm font-medium">{formatNum(c.floorMon)}</p>
            <p className="text-[10px] text-gray-700 uppercase tracking-wide">MON</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-gray-400 text-sm font-medium">{formatNum(c.oneDayVolumeMon)}</p>
            <p className="text-[10px] text-gray-700 uppercase tracking-wide">MON</p>
          </div>
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
