"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatEther } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  COLLECTION_ABI,
  type Listing,
} from "@/lib/contracts";
import { ipfsToHttp } from "@/lib/ipfs";
import { shortenAddress } from "@/lib/utils";
import {
  Loader2,
  Search,
  TrendingUp,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Layers,
  Tag,
  Users,
  Flame,
  Clock,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

type RateResponse = {
  anagoPerMon: number;
  cachedAt: number;
  cached?: boolean;
  stale?: boolean;
  error?: string;
};

type CollectionMeta = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  totalMinted: number;
  maxSupply: number;
  owner: `0x${string}`;
};

type SortKey = "floor_desc" | "floor_asc" | "recent" | "listings";

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

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Page                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function CollectionsPage() {
  const [rate, setRate] = useState<RateResponse | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("listings");
  const [refreshTick, setRefreshTick] = useState(0);

  /* ── 1. On-chain AnagoPlace collection addresses ──────────────────────── */
  const { data: onchainAddrs, isLoading: loadingAddrs, refetch: refetchAddrs } =
    useReadContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "getAllCollections",
    });

  const addresses = (onchainAddrs as `0x${string}`[] | undefined) ?? [];

  /* ── 2. Batch fetch collection metadata via multicall ────────────────── */
  const infoContracts = useMemo(
    () =>
      addresses.map((addr) => ({
        address: addr,
        abi: COLLECTION_ABI,
        functionName: "getCollectionInfo" as const,
      })),
    [addresses]
  );

  const { data: infoResults, isLoading: loadingInfo, refetch: refetchInfo } = useReadContracts({
    contracts: infoContracts,
    allowFailure: true,
    query: { enabled: infoContracts.length > 0 },
  });

  /* ── 3. Batch fetch all active marketplace listings ───────────────────── */
  const {
    data: listingsResult,
    isLoading: loadingListings,
    refetch: refetchListings,
  } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getActiveListings",
    args: [0n, 1000n],
  });

  const activeListings = useMemo<Listing[]>(() => {
    if (!listingsResult) return [];
    const tuple = listingsResult as unknown as [Listing[], bigint];
    return tuple[0] ?? [];
  }, [listingsResult]);

  /* ── 4. Live MON↔ANAGO rate ───────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/rate/mon-anago`, { cache: "no-store" })
        .then((r) => r.json())
        .then((json: RateResponse) => {
          if (cancelled) return;
          if (typeof json.anagoPerMon === "number" && json.anagoPerMon > 0) setRate(json);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  /* ── 5. Build per-collection stats: floor + listing count ─────────────── */
  const statsByCollection = useMemo(() => {
    const map = new Map<string, { floorMon: number | null; listings: number; volumeMon: number }>();
    for (const l of activeListings) {
      const key = l.collection.toLowerCase();
      const priceMon = Number(formatEther(l.price));
      const curr = map.get(key) ?? { floorMon: null, listings: 0, volumeMon: 0 };
      curr.listings += 1;
      curr.volumeMon += priceMon;
      if (curr.floorMon === null || priceMon < curr.floorMon) curr.floorMon = priceMon;
      map.set(key, curr);
    }
    return map;
  }, [activeListings]);

  /* ── 6. Combine metadata ──────────────────────────────────────────────── */
  const collections = useMemo<CollectionMeta[]>(() => {
    if (!infoResults) return [];
    return addresses
      .map((addr, i) => {
        const r = infoResults[i];
        if (!r || r.status !== "success" || !r.result) return null;
        const tuple = r.result as unknown as [
          string,
          string,
          bigint,
          bigint,
          string,
          string,
          `0x${string}`
        ];
        const [name, symbol, maxSupply, totalMinted, description, image, owner] = tuple;
        return {
          address: addr,
          name,
          symbol,
          description,
          image,
          totalMinted: Number(totalMinted),
          maxSupply: Number(maxSupply),
          owner,
        } satisfies CollectionMeta;
      })
      .filter((x): x is CollectionMeta => x !== null);
  }, [addresses, infoResults]);

  /* ── 7. Search + sort ─────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? collections.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.symbol.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q)
        )
      : collections;

    const withStats = list.map((c) => ({
      ...c,
      stats: statsByCollection.get(c.address.toLowerCase()) ?? {
        floorMon: null,
        listings: 0,
        volumeMon: 0,
      },
    }));

    withStats.sort((a, b) => {
      if (sortKey === "listings") return b.stats.listings - a.stats.listings;
      if (sortKey === "recent")
        return addresses.indexOf(b.address) - addresses.indexOf(a.address);
      const af = a.stats.floorMon ?? Number.POSITIVE_INFINITY;
      const bf = b.stats.floorMon ?? Number.POSITIVE_INFINITY;
      if (sortKey === "floor_asc") return af - bf;
      return (b.stats.floorMon ?? -1) - (a.stats.floorMon ?? -1);
    });
    return withStats;
  }, [collections, statsByCollection, search, sortKey, addresses]);

  /* ── 8. Aggregate protocol-wide stats ─────────────────────────────────── */
  const aggregate = useMemo(() => {
    const totalItems = collections.reduce((s, c) => s + c.totalMinted, 0);
    const totalListings = activeListings.length;
    const totalListedMon = activeListings.reduce(
      (s, l) => s + Number(formatEther(l.price)),
      0
    );
    return { totalItems, totalListings, totalListedMon };
  }, [collections, activeListings]);

  const anagoPerMon = rate?.anagoPerMon ?? null;
  const loading = loadingAddrs || loadingInfo || loadingListings;

  const refreshAll = () => {
    refetchAddrs();
    refetchInfo();
    refetchListings();
    setRefreshTick((t) => t + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.05] bg-gradient-to-br from-monad-950/60 via-[#0d0d0d] to-[#0d0d0d] p-6 md:p-8 mb-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_10%_20%,rgba(131,110,249,0.12)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_90%_80%,rgba(131,110,249,0.08)_0%,transparent_60%)] pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-monad-500/10 border border-monad-500/20 rounded-full px-2.5 py-1 text-[10px] text-monad-300 font-semibold tracking-wider mb-3">
              <Sparkles size={10} />
              ON-CHAIN · MONAD
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Discover Collections
            </h1>
            <p className="text-gray-500 text-sm mt-2 max-w-xl">
              Every collection listed here lives fully on-chain, trades in{" "}
              <span className="text-monad-400 font-semibold">ANAGO</span>, and settles
              on <span className="text-white">Monad</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-black/40 backdrop-blur border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
              <Activity
                size={12}
                className={rate ? "text-green-400 animate-pulse" : "text-gray-700"}
              />
              {anagoPerMon ? (
                <>
                  <span className="text-gray-500">1 MON =</span>
                  <span className="text-white font-semibold">
                    {formatNum(anagoPerMon)} ANAGO
                  </span>
                </>
              ) : (
                <span className="text-gray-600">Rate loading…</span>
              )}
            </div>
            <button
              onClick={refreshAll}
              className="bg-black/40 backdrop-blur border border-white/[0.06] hover:border-monad-500/30 text-gray-400 hover:text-white rounded-xl p-2 transition-all"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Stats tiles */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <StatTile
            icon={<Layers size={14} className="text-monad-400" />}
            label="Collections"
            value={loadingAddrs ? "…" : formatNum(addresses.length, 0)}
          />
          <StatTile
            icon={<Sparkles size={14} className="text-monad-400" />}
            label="Items Minted"
            value={loadingInfo ? "…" : formatNum(aggregate.totalItems, 0)}
          />
          <StatTile
            icon={<Tag size={14} className="text-monad-400" />}
            label="Active Listings"
            value={loadingListings ? "…" : formatNum(aggregate.totalListings, 0)}
          />
          <StatTile
            icon={<Flame size={14} className="text-monad-400" />}
            label="Listed Value"
            value={
              anagoPerMon
                ? `${formatNum(aggregate.totalListedMon * anagoPerMon, 0)} ANAGO`
                : `${formatNum(aggregate.totalListedMon)} MON`
            }
          />
        </div>
      </div>

      {/* ─── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, symbol, or address..."
            className="w-full bg-[#111111] border border-white/[0.05] focus:border-monad-500/30 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-700 outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <SortPill
            active={sortKey === "listings"}
            onClick={() => setSortKey("listings")}
            icon={<TrendingUp size={12} />}
            label="Top Listed"
          />
          <SortPill
            active={sortKey === "floor_desc"}
            onClick={() => setSortKey("floor_desc")}
            icon={<Flame size={12} />}
            label="Highest Floor"
          />
          <SortPill
            active={sortKey === "floor_asc"}
            onClick={() => setSortKey("floor_asc")}
            icon={<Tag size={12} />}
            label="Lowest Floor"
          />
          <SortPill
            active={sortKey === "recent"}
            onClick={() => setSortKey("recent")}
            icon={<Clock size={12} />}
            label="Newest"
          />
        </div>
      </div>

      {/* ─── Collection grid ────────────────────────────────────────────── */}
      {loading && filtered.length === 0 ? (
        <div className="py-24 flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-monad-500 animate-spin" />
          <p className="text-gray-600 text-xs">Loading on-chain collections…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-12 text-center">
          <div className="inline-flex bg-monad-500/10 border border-monad-500/20 rounded-2xl p-3 mb-4">
            <Layers size={24} className="text-monad-400" />
          </div>
          <p className="text-white font-bold text-base mb-1">
            {search ? "No collections match" : "No collections yet"}
          </p>
          <p className="text-gray-500 text-xs mb-5">
            {search
              ? "Try a different keyword or clear the filter."
              : "Be the first to deploy a collection on AnagoPlace."}
          </p>
          {!search && (
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-monad-500 hover:bg-monad-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 text-xs"
            >
              <Sparkles size={12} />
              Create First Collection
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c, idx) => (
            <CollectionCard
              key={c.address}
              data={c}
              rank={idx + 1}
              anagoPerMon={anagoPerMon}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-gray-700">
          100% on-chain · no indexers · no third-party APIs
        </p>
        <p className="text-[11px] text-gray-700">
          Prices settle in{" "}
          <span className="text-monad-400 font-semibold">ANAGO</span> · Rate via
          Relay
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Components                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-black/40 backdrop-blur border border-white/[0.06] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-white font-bold text-lg leading-tight truncate">{value}</p>
    </div>
  );
}

function SortPill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap text-xs font-semibold px-3.5 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 ${
        active
          ? "bg-monad-500/20 border-monad-500/40 text-monad-300"
          : "bg-[#111111] border-white/[0.05] text-gray-500 hover:text-white hover:border-white/10"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CollectionCard({
  data,
  rank,
  anagoPerMon,
}: {
  data: CollectionMeta & {
    stats: { floorMon: number | null; listings: number; volumeMon: number };
  };
  rank: number;
  anagoPerMon: number | null;
}) {
  const imgSrc = data.image ? ipfsToHttp(data.image) : "/anago-hero.png";
  const progress =
    data.maxSupply > 0 ? Math.min(100, (data.totalMinted / data.maxSupply) * 100) : 0;
  const floorAnago =
    data.stats.floorMon !== null && anagoPerMon
      ? data.stats.floorMon * anagoPerMon
      : null;

  return (
    <Link
      href={`/collection/${data.address}`}
      className="group relative bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden hover:border-monad-500/30 hover:shadow-[0_0_25px_rgba(131,110,249,0.1)] transition-all duration-300"
    >
      {/* Rank badge */}
      <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white">
        #{rank}
      </div>
      {data.stats.listings > 0 && (
        <div className="absolute top-3 right-3 z-20 bg-green-500/15 border border-green-500/30 rounded-lg px-2 py-0.5 text-[10px] font-bold text-green-300 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
          {data.stats.listings} listed
        </div>
      )}

      {/* Banner */}
      <div className="relative h-32 bg-gradient-to-br from-monad-950 to-[#0d0d0d] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(131,110,249,0.2)_0%,transparent_70%)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={data.name}
          className="w-full h-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-105 transition-all duration-500"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/anago-hero.png";
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#111111] to-transparent" />
      </div>

      {/* Avatar */}
      <div className="px-4 -mt-7 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border-2 border-[#111111] overflow-hidden ring-1 ring-monad-500/25 shadow-lg shadow-monad-500/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={data.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/anago-logo.png";
            }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-sm truncate group-hover:text-monad-300 transition-colors">
              {data.name || "Unnamed"}
            </p>
            <p className="text-gray-600 text-[10px] font-mono truncate mt-0.5">
              {data.symbol} · {shortenAddress(data.address)}
            </p>
          </div>
          <ArrowUpRight
            size={14}
            className="text-gray-700 group-hover:text-monad-400 transition-colors flex-shrink-0 mt-0.5"
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-black/40 border border-white/[0.04] rounded-lg px-2.5 py-2">
            <div className="text-[9px] text-gray-700 uppercase tracking-wider font-semibold">
              Floor
            </div>
            {data.stats.floorMon !== null ? (
              <>
                <p className="text-white text-[13px] font-bold leading-tight truncate">
                  {floorAnago !== null ? `${formatNum(floorAnago)}` : "—"}
                  <span className="text-[9px] text-monad-400 ml-1">ANAGO</span>
                </p>
                <p className="text-[9px] text-gray-700 truncate">
                  {formatNum(data.stats.floorMon)} MON
                </p>
              </>
            ) : (
              <p className="text-gray-600 text-[13px] font-bold leading-tight">—</p>
            )}
          </div>
          <div className="bg-black/40 border border-white/[0.04] rounded-lg px-2.5 py-2">
            <div className="text-[9px] text-gray-700 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Users size={9} />
              Supply
            </div>
            <p className="text-white text-[13px] font-bold leading-tight truncate">
              {formatNum(data.totalMinted, 0)}
              <span className="text-gray-700 font-normal">
                /{data.maxSupply > 0 ? formatNum(data.maxSupply, 0) : "∞"}
              </span>
            </p>
            <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-monad-500 to-monad-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
