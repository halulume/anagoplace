"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  Globe,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

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

type OsResponse = {
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

type SortKey = "top" | "new" | "floor_desc" | "floor_asc";

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
  const [rate, setRate] = useState<RateResponse | null>(null);
  const [os, setOs] = useState<OsResponse | null>(null);
  const [loadingOs, setLoadingOs] = useState(true);
  const [osError, setOsError] = useState<string | null>(null);
  const [osMissingKey, setOsMissingKey] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("top");
  const [refreshTick, setRefreshTick] = useState(0);

  /* ── 1. On-chain AnagoPlace collection addresses ──────────────────────── */
  const { data: onchainAddrs, isLoading: loadingAddrs, refetch: refetchAddrs } =
    useReadContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "getAllCollections",
    });

  const addresses = (onchainAddrs as `0x${string}`[] | undefined) ?? [];

  /* ── 2. Batch fetch on-chain collection metadata ─────────────────────── */
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

  /* ── 3. Active marketplace listings for per-collection floor ──────────── */
  const { data: listingsResult, refetch: refetchListings } = useReadContract({
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

  /* ── 4. OpenSea fetch ────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    setLoadingOs(true);
    setOsError(null);
    setOsMissingKey(false);

    const orderBy = sortKey === "new" ? "created_date" : "market_cap";

    (async () => {
      try {
        const res = await fetch(
          `/api/opensea/collections?order_by=${orderBy}&limit=50`,
          { cache: "no-store" }
        );
        const json: OsResponse = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          if (json.error === "missing_api_key") setOsMissingKey(true);
          else setOsError(json.message || json.error || "Failed to load OpenSea data.");
          setOs(null);
        } else {
          setOs(json);
        }
      } catch (e) {
        if (!cancelled) setOsError((e as Error).message || "Network error.");
      } finally {
        if (!cancelled) setLoadingOs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sortKey, refreshTick]);

  /* ── 5. Live MON↔ANAGO rate, auto-refresh ─────────────────────────────── */
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

  /* ── 6. Build per-collection on-chain stats ───────────────────────────── */
  const onchainStats = useMemo(() => {
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

  /* ── 7. Build on-chain metadata list ──────────────────────────────────── */
  const onchainCollections = useMemo<
    (CollectionMeta & { stats: { floorMon: number | null; listings: number; volumeMon: number } })[]
  >(() => {
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
          stats: onchainStats.get(addr.toLowerCase()) ?? {
            floorMon: null,
            listings: 0,
            volumeMon: 0,
          },
        };
      })
      .filter(<T,>(x: T | null): x is T => x !== null);
  }, [addresses, infoResults, onchainStats]);

  /* ── 8. Filter + sort OpenSea rows ────────────────────────────────────── */
  const osRows = useMemo(() => {
    if (!os) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? os.collections.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
        )
      : os.collections;

    const sorted = [...list];
    if (sortKey === "floor_desc")
      sorted.sort((a, b) => (b.floorMon ?? -1) - (a.floorMon ?? -1));
    else if (sortKey === "floor_asc")
      sorted.sort(
        (a, b) =>
          (a.floorMon ?? Number.POSITIVE_INFINITY) - (b.floorMon ?? Number.POSITIVE_INFINITY)
      );
    return sorted;
  }, [os, search, sortKey]);

  /* ── 9. Filter on-chain ───────────────────────────────────────────────── */
  const onchainFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return onchainCollections;
    return onchainCollections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [onchainCollections, search]);

  /* ── 10. Aggregate stats ──────────────────────────────────────────────── */
  const anagoPerMon = rate?.anagoPerMon ?? null;
  const loading = loadingOs || loadingAddrs || loadingInfo;

  const aggregate = useMemo(() => {
    const osCount = osRows.length;
    const osFloorSum = osRows.reduce(
      (s, c) => s + (c.floorMon ?? 0),
      0
    );
    const os24hVol = osRows.reduce(
      (s, c) => s + (c.oneDayVolumeMon ?? 0),
      0
    );
    return { osCount, osFloorSum, os24hVol };
  }, [osRows]);

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
              MONAD · POWERED BY OPENSEA
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Discover Collections
            </h1>
            <p className="text-gray-500 text-sm mt-2 max-w-xl">
              Every Monad NFT collection, priced live in{" "}
              <span className="text-monad-400 font-semibold">ANAGO</span> via the
              on-chain MON pool rate.
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
            value={loadingOs ? "…" : formatNum(aggregate.osCount, 0)}
          />
          <StatTile
            icon={<Flame size={14} className="text-monad-400" />}
            label="24h Volume"
            value={
              anagoPerMon
                ? `${formatNum(aggregate.os24hVol * anagoPerMon)} ANAGO`
                : `${formatNum(aggregate.os24hVol)} MON`
            }
          />
          <StatTile
            icon={<Tag size={14} className="text-monad-400" />}
            label="Avg Floor"
            value={
              osRows.length > 0 && anagoPerMon
                ? `${formatNum((aggregate.osFloorSum / osRows.length) * anagoPerMon)} ANAGO`
                : "—"
            }
          />
          <StatTile
            icon={<ShieldCheck size={14} className="text-monad-400" />}
            label="AnagoPlace"
            value={
              loadingAddrs
                ? "…"
                : `${formatNum(addresses.length, 0)} native`
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
            placeholder="Search collections..."
            className="w-full bg-[#111111] border border-white/[0.05] focus:border-monad-500/30 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-700 outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <SortPill
            active={sortKey === "top"}
            onClick={() => setSortKey("top")}
            icon={<TrendingUp size={12} />}
            label="Top"
          />
          <SortPill
            active={sortKey === "new"}
            onClick={() => setSortKey("new")}
            icon={<Clock size={12} />}
            label="New"
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
        </div>
      </div>

      {/* ─── OpenSea Monad discover ───────────────────────────────────── */}
      <SectionHeader
        icon={<Globe size={14} className="text-blue-400" />}
        title="Monad · All Collections"
        subtitle="Live from OpenSea · Floor prices converted to ANAGO"
      />

      {osMissingKey ? (
        <OpenSeaSetupBanner />
      ) : loadingOs && !os ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-monad-500 animate-spin" />
          <p className="text-gray-600 text-xs">Loading from OpenSea…</p>
        </div>
      ) : osError ? (
        <div className="bg-[#111111] border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center mb-8">
          <AlertCircle size={28} className="text-red-400 mb-2" />
          <p className="text-white font-bold text-sm mb-1">Could not load OpenSea data</p>
          <p className="text-gray-500 text-xs max-w-md">{osError}</p>
        </div>
      ) : !osRows.length ? (
        <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-10 text-center mb-8">
          <p className="text-gray-500 text-sm">
            {search ? "No OpenSea collections match." : "No Monad data yet."}
          </p>
        </div>
      ) : (
        <CollectionsTable rows={osRows} anagoPerMon={anagoPerMon} />
      )}

      {/* ─── AnagoPlace native ─────────────────────────────────────────── */}
      <div className="mt-10">
        <SectionHeader
          icon={<ShieldCheck size={14} className="text-monad-400" />}
          title="AnagoPlace · Native Collections"
          subtitle="Deployed directly on AnagoPlace · ANAGO-native marketplace"
        />

        {loadingAddrs || loadingInfo ? (
          <div className="py-12 flex justify-center">
            <Loader2 size={20} className="text-monad-500 animate-spin" />
          </div>
        ) : onchainFiltered.length === 0 ? (
          <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-10 text-center mb-8">
            <p className="text-gray-500 text-sm mb-3">
              {search
                ? "No native collections match."
                : "No AnagoPlace collections deployed yet."}
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
            {onchainFiltered.map((c, idx) => (
              <OnchainCard
                key={c.address}
                data={c}
                rank={idx + 1}
                anagoPerMon={anagoPerMon}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-gray-700">
          Discover via OpenSea · Trade on AnagoPlace in ANAGO
        </p>
        <p className="text-[11px] text-gray-700">
          Live MON↔ANAGO rate via Relay
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
      <div className="bg-[#111111] border border-white/[0.05] rounded-lg p-1.5">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="text-[10px] text-gray-600">{subtitle}</p>
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
            <p className="text-gray-400 text-sm font-medium">
              {formatNum(c.oneDayVolumeMon)}
            </p>
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

function OnchainCard({
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
    data.maxSupply > 0
      ? Math.min(100, (data.totalMinted / data.maxSupply) * 100)
      : 0;
  const floorAnago =
    data.stats.floorMon !== null && anagoPerMon
      ? data.stats.floorMon * anagoPerMon
      : null;

  return (
    <Link
      href={`/collection/${data.address}`}
      className="group relative bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden hover:border-monad-500/30 hover:shadow-[0_0_25px_rgba(131,110,249,0.1)] transition-all duration-300"
    >
      <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white">
        #{rank}
      </div>
      {data.stats.listings > 0 && (
        <div className="absolute top-3 right-3 z-20 bg-green-500/15 border border-green-500/30 rounded-lg px-2 py-0.5 text-[10px] font-bold text-green-300 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
          {data.stats.listings} listed
        </div>
      )}

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

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-black/40 border border-white/[0.04] rounded-lg px-2.5 py-2">
            <div className="text-[9px] text-gray-700 uppercase tracking-wider font-semibold">
              Floor
            </div>
            {data.stats.floorMon !== null ? (
              <>
                <p className="text-white text-[13px] font-bold leading-tight truncate">
                  {floorAnago !== null ? formatNum(floorAnago) : "—"}
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

function OpenSeaSetupBanner() {
  return (
    <div className="bg-gradient-to-br from-monad-950/60 to-[#0d0d0d] border border-monad-500/20 rounded-2xl p-6 md:p-8 mb-8">
      <div className="flex items-start gap-4">
        <div className="bg-monad-500/15 border border-monad-500/25 rounded-xl p-3 flex-shrink-0">
          <AlertCircle size={20} className="text-monad-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-base mb-1">
            OpenSea API key required
          </h3>
          <p className="text-gray-500 text-xs leading-relaxed mb-4">
            Add <code className="bg-black/40 px-1.5 py-0.5 rounded text-monad-300 font-mono text-[11px]">OPENSEA_API_KEY</code>{" "}
            to your Vercel environment variables and redeploy.
          </p>
          <a
            href="https://vercel.com/halulume/anagoplace/settings/environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-monad-500 hover:bg-monad-400 text-white font-semibold px-3 py-2 rounded-lg transition-all text-xs"
          >
            Open Vercel Settings
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
