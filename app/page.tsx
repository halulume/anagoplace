"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  Flame,
  Crown,
  Trophy,
  Activity,
} from "lucide-react";
import { useReadContract } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI, MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "@/lib/contracts";
import { useState, useEffect, useMemo } from "react";
import { useMonPrice, formatUsd } from "@/lib/price";

/* ── Types for OpenSea + rate fetches ──────────────────────────────────── */
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
type OsResponse = { collections: OsCollection[]; error?: string };
type RateResponse = { anagoPerMon: number; error?: string };

type LiveActivity = {
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

type LiveTrending = {
  tokenId: string;
  tokenName: string;
  image: string | null;
  collection: string;
  collectionName: string;
  priceMon: number | null;
  paymentSymbol: string;
  openseaUrl: string;
};

function timeAgo(tsSec: number): string {
  if (!tsSec) return "—";
  const diff = Math.max(0, Date.now() / 1000 - tsSec);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtShort(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (n < 1) return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  if (n < 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "K";
  return (n / 1_000_000).toFixed(1) + "M";
}

export default function HomePage() {
  const { price: monUsdPrice } = useMonPrice();

  const { data: totalCollections } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getTotalCollections",
  });

  const { data: listingCount } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "listingCount",
  });

  /* ── Live top-3 hero from OpenSea (sorted by floor price desc) ─────── */
  const [heroIndex, setHeroIndex] = useState(0);
  const [topCollections, setTopCollections] = useState<OsCollection[]>([]);
  const [anagoPerMon, setAnagoPerMon] = useState<number | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);

  // Live feeds
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([]);
  const [liveTrending, setLiveTrending] = useState<LiveTrending[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [colRes, rateRes] = await Promise.all([
          fetch(`/api/opensea/collections?order_by=market_cap&limit=50`, { cache: "no-store" }),
          fetch(`/api/rate/mon-anago`, { cache: "no-store" }),
        ]);
        const colJson: OsResponse = await colRes.json().catch(() => ({ collections: [] }));
        const rateJson: RateResponse = await rateRes.json().catch(() => ({ anagoPerMon: 0 }));
        if (cancelled) return;

        // Pick top 3 by floor price (desc), skipping nulls
        const top = (colJson.collections ?? [])
          .filter((c) => typeof c.floorMon === "number" && c.floorMon! > 0)
          .sort((a, b) => (b.floorMon ?? 0) - (a.floorMon ?? 0))
          .slice(0, 3);
        setTopCollections(top);
        if (typeof rateJson.anagoPerMon === "number" && rateJson.anagoPerMon > 0) {
          setAnagoPerMon(rateJson.anagoPerMon);
        }
      } catch {
        /* ignore — fallback renders below */
      } finally {
        if (!cancelled) setHeroLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-refresh rate every 45s
  useEffect(() => {
    const id = setInterval(() => {
      fetch(`/api/rate/mon-anago`, { cache: "no-store" })
        .then((r) => r.json())
        .then((json: RateResponse) => {
          if (typeof json.anagoPerMon === "number" && json.anagoPerMon > 0)
            setAnagoPerMon(json.anagoPerMon);
        })
        .catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, []);

  // Live feeds: activities (30s) + trending (45s) — combined poll every 30s
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          fetch("/api/opensea/activities?limit=10", { cache: "no-store" }),
          fetch("/api/opensea/trending?limit=10", { cache: "no-store" }),
        ]);
        const aJson = await aRes.json().catch(() => ({}));
        const tJson = await tRes.json().catch(() => ({}));
        if (cancelled) return;
        if (Array.isArray(aJson.activities)) setLiveActivities(aJson.activities);
        if (Array.isArray(tJson.nfts)) setLiveTrending(tJson.nfts);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Cycle the hero every 5s
  useEffect(() => {
    if (topCollections.length < 2) return;
    const t = setInterval(
      () => setHeroIndex((i) => (i + 1) % topCollections.length),
      5000
    );
    return () => clearInterval(t);
  }, [topCollections.length]);

  const currentHero = useMemo<OsCollection | null>(
    () => (topCollections.length > 0 ? topCollections[heroIndex] ?? topCollections[0] : null),
    [topCollections, heroIndex]
  );

  const heroRank = heroIndex + 1;
  const rankMeta = [
    { label: "#1 TOP FLOOR", icon: Crown, color: "from-amber-400 to-yellow-500", shadow: "rgba(251,191,36,0.45)" },
    { label: "#2 ELITE", icon: Trophy, color: "from-slate-300 to-slate-400", shadow: "rgba(148,163,184,0.4)" },
    { label: "#3 RISING", icon: Flame, color: "from-orange-400 to-red-500", shadow: "rgba(251,113,36,0.4)" },
  ][heroIndex] ?? { label: "FEATURED", icon: Crown, color: "from-monad-400 to-monad-600", shadow: "rgba(131,110,249,0.4)" };

  const stats = [
    { label: "Collections", value: totalCollections ? totalCollections.toString() : "0" },
    { label: "Listings", value: listingCount ? listingCount.toString() : "0" },
    { label: "Trading Fee", value: "2.5%" },
    { label: "MON Price", value: monUsdPrice ? formatUsd(monUsdPrice) : "Live ●" },
  ];

  return (
    <div className="min-h-screen">
      {/* ── Announcement Banner ── */}
      <div className="bg-gradient-to-r from-monad-950 via-monad-500/20 to-monad-950 border-b border-monad-500/15 py-2 px-4 text-center text-xs text-monad-300 flex items-center justify-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-monad-400 animate-pulse shadow-[0_0_6px_rgba(131,110,249,0.8)]" />
        AnagoPlace is live on Monad — Create, mint &amp; trade NFTs with ANAGO token
        <Link href="/explore" className="underline underline-offset-2 hover:text-white transition-colors">
          Explore now →
        </Link>
      </div>

      {/* ── Hero / Live Top-3 Carousel ── */}
      <section className="relative overflow-hidden">
        <div className="relative h-[460px] sm:h-[520px]">
          {/* Animated gradient bg */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0020] via-[#0a0a0a] to-[#000d1a]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_40%,rgba(131,110,249,0.15)_0%,transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_80%,rgba(0,212,255,0.08)_0%,transparent_60%)]" />

          {/* Collection banner as blurred background */}
          {currentHero?.banner && (
            <div
              key={currentHero.slug + "-bg"}
              className="absolute inset-0 opacity-20 animate-[fade-in_700ms_ease-out] transition-opacity duration-700"
              style={{
                backgroundImage: `url(${currentHero.banner})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(40px)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a]/70 via-transparent to-[#0a0a0a]/80" />

          {/* Content */}
          <div className="relative h-full max-w-7xl mx-auto px-6 flex items-center gap-8">
            {/* Left: text + CTAs */}
            <div className="flex-1 max-w-xl">
              {/* Rank badge */}
              <span
                className={`inline-flex items-center gap-2 bg-gradient-to-r ${rankMeta.color} rounded-full px-3 py-1 text-[11px] font-black text-black mb-5 uppercase tracking-wider shadow-lg`}
                style={{ boxShadow: `0 0 24px ${rankMeta.shadow}` }}
              >
                <rankMeta.icon size={12} strokeWidth={2.5} />
                {rankMeta.label}
              </span>

              {/* Live rate ticker */}
              <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3">
                <Activity
                  size={10}
                  className={anagoPerMon ? "text-green-400 animate-pulse" : "text-gray-700"}
                />
                {anagoPerMon ? (
                  <>
                    <span className="text-gray-600">LIVE</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-white font-semibold">1 MON = {fmtShort(anagoPerMon)} ANAGO</span>
                  </>
                ) : (
                  <span className="text-gray-700">Rate loading…</span>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-2 tracking-tight truncate">
                {currentHero?.name ??
                  (heroLoading ? "Loading…" : "AnagoPlace")}
              </h1>
              <p className="text-gray-400 text-sm sm:text-base mb-6 leading-relaxed line-clamp-2">
                {currentHero?.description?.trim() ||
                  "Discover the top Monad NFT collections — trade on AnagoPlace in ANAGO."}
              </p>

              {/* Price row */}
              {currentHero && (
                <div className="flex items-center gap-4 mb-6 flex-wrap">
                  <div className="bg-black/40 backdrop-blur border border-white/[0.08] rounded-xl px-4 py-2.5">
                    <div className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">
                      Floor
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-white text-xl font-black">
                        {anagoPerMon && currentHero.floorMon
                          ? fmtShort(currentHero.floorMon * anagoPerMon)
                          : "—"}
                      </span>
                      <span className="text-[10px] text-monad-400 font-semibold">ANAGO</span>
                    </div>
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      {fmtShort(currentHero.floorMon)} MON
                    </div>
                  </div>
                  {typeof currentHero.oneDayVolumeMon === "number" && (
                    <div className="bg-black/40 backdrop-blur border border-white/[0.08] rounded-xl px-4 py-2.5">
                      <div className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">
                        24h Vol
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-white text-xl font-black">
                          {fmtShort(currentHero.oneDayVolumeMon)}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold">MON</span>
                      </div>
                      {typeof currentHero.owners === "number" && (
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          {fmtShort(currentHero.owners)} owners
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/collections"
                  className="flex items-center gap-2 bg-monad-500 hover:bg-monad-400 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 text-sm shadow-[0_0_20px_rgba(131,110,249,0.3)] hover:shadow-[0_0_30px_rgba(131,110,249,0.5)] hover:scale-[1.02]"
                >
                  Explore Top Collections
                  <ArrowRight size={15} />
                </Link>
                {currentHero && (
                  <a
                    href={currentHero.openseaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 text-sm hover:scale-[1.02]"
                  >
                    View Collection
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </div>

              {/* Carousel dots */}
              <div className="flex items-center gap-2 mt-8">
                {topCollections.length > 0
                  ? topCollections.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setHeroIndex(i)}
                        className={`transition-all duration-300 rounded-full ${
                          i === heroIndex
                            ? "w-6 h-1.5 bg-monad-400"
                            : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                        }`}
                      />
                    ))
                  : [0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    ))}
              </div>
            </div>

            {/* Right: Collection artwork */}
            <div className="hidden lg:flex flex-shrink-0 items-center justify-center">
              <div className="relative w-80 h-80">
                <div className="absolute inset-0 bg-monad-500/10 rounded-3xl blur-[60px] animate-pulse" />
                <div className="absolute inset-[-8%] border border-monad-500/10 rounded-3xl animate-spin-slow" />
                <div
                  className="absolute inset-[8%] border border-cyan-500/5 rounded-3xl animate-spin-slow"
                  style={{ animationDirection: "reverse" }}
                />
                {currentHero?.image ? (
                  <div
                    key={currentHero.slug + "-art"}
                    className="relative w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_80px_rgba(131,110,249,0.25)] animate-[fade-in_600ms_ease-out]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentHero.image}
                      alt={currentHero.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/anago-hero.png";
                      }}
                    />
                    {/* Rank overlay */}
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-white/15 rounded-xl px-2.5 py-1 text-xs font-black text-white">
                      #{heroRank}
                    </div>
                    {/* Price badge */}
                    <div className="absolute bottom-3 right-3 bg-gradient-to-r from-monad-500 to-accent-pink text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg">
                      <div className="text-[10px] opacity-80 mb-0.5">TOP FLOOR</div>
                      <div className="text-base font-black">
                        {anagoPerMon && currentHero.floorMon
                          ? `${fmtShort(currentHero.floorMon * anagoPerMon)} ANAGO`
                          : `${fmtShort(currentHero.floorMon)} MON`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Image
                    src="/anago-hero.png"
                    alt="Anago"
                    fill
                    className="object-contain animate-float drop-shadow-[0_0_40px_rgba(131,110,249,0.25)]"
                    priority
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>
      </section>

      {/* ── Stats row ── */}
      <section className="border-y border-white/[0.04] bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.04]">
          {stats.map((s) => (
            <div key={s.label} className="px-6 first:pl-0 last:pr-0 text-center sm:text-left">
              <p className="text-xl sm:text-2xl font-black text-white">{s.value}</p>
              <p className="text-[11px] text-gray-600 mt-0.5 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Latest Activities ── */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Latest Activities</h2>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <Link
            href="/explore"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>

        {/* Horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {liveActivities.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[220px] bg-[#111111] border border-white/[0.05] rounded-2xl p-3"
                >
                  <div className="relative w-full aspect-square rounded-xl bg-white/[0.03] mb-3 animate-pulse" />
                  <div className="h-3 w-2/3 bg-white/[0.05] rounded mb-2 animate-pulse" />
                  <div className="h-2 w-1/2 bg-white/[0.03] rounded animate-pulse" />
                </div>
              ))
            : liveActivities.map((item) => {
                const priceAnago =
                  anagoPerMon && item.priceMon ? item.priceMon * anagoPerMon : null;
                return (
                  <a
                    key={`${item.txHash}-${item.tokenId}`}
                    href={item.openseaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-[220px] bg-[#111111] border border-white/[0.05] rounded-2xl p-3 hover:border-monad-500/20 hover:bg-[#141414] transition-all duration-200 group"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-[#1a1a1a]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image || "/anago-hero.png"}
                        alt={item.tokenName}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/anago-hero.png";
                        }}
                      />
                      <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                        SALE
                      </span>
                    </div>
                    <p className="text-white font-semibold text-sm truncate">{item.tokenName}</p>
                    <p className="text-gray-600 text-[11px] truncate mb-2">{item.collectionName}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-bold">
                        {priceAnago
                          ? `${fmtShort(priceAnago)}`
                          : item.priceMon
                            ? `${fmtShort(item.priceMon)}`
                            : "—"}
                      </span>
                      <span className="text-[9px] text-monad-400 font-semibold uppercase tracking-wide">
                        {priceAnago ? "ANAGO" : item.paymentSymbol}
                      </span>
                    </div>
                    <p className="text-gray-700 text-[10px] mt-1">{timeAgo(item.timestamp)}</p>
                  </a>
                );
              })}
        </div>
      </section>

      {/* ── Trending NFTs ── */}
      <section className="max-w-7xl mx-auto px-6 py-4 pb-16">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Trending NFTs</h2>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <Link
            href="/explore"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {liveTrending.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden"
                >
                  <div className="aspect-square bg-white/[0.03] animate-pulse" />
                  <div className="p-3">
                    <div className="h-3 w-2/3 bg-white/[0.05] rounded mb-2 animate-pulse" />
                    <div className="h-2 w-1/2 bg-white/[0.03] rounded animate-pulse" />
                  </div>
                </div>
              ))
            : liveTrending.map((nft, i) => {
                const priceAnago =
                  anagoPerMon && nft.priceMon ? nft.priceMon * anagoPerMon : null;
                return (
                  <a
                    key={`${nft.collection}-${nft.tokenId}`}
                    href={nft.openseaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-monad-500/20"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-[#1a1a1a] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={nft.image || "/anago-hero.png"}
                        alt={nft.tokenName}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/anago-hero.png";
                        }}
                      />
                      {/* Rank badge (top 3 only) */}
                      {i < 3 && (
                        <div
                          className={`absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r ${
                            i === 0
                              ? "from-amber-400 to-yellow-500"
                              : i === 1
                                ? "from-slate-300 to-slate-400"
                                : "from-orange-400 to-red-500"
                          } text-black shadow-lg uppercase tracking-wide`}
                        >
                          #{i + 1}
                        </div>
                      )}
                      {/* Quick view overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="bg-white/10 backdrop-blur-sm rounded-full p-2 border border-white/20">
                          <ArrowUpRight size={16} className="text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-white text-xs font-semibold truncate">{nft.tokenName}</p>
                      <p className="text-gray-600 text-[10px] truncate mb-2">{nft.collectionName}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-bold">
                          {priceAnago
                            ? fmtShort(priceAnago)
                            : nft.priceMon
                              ? fmtShort(nft.priceMon)
                              : "—"}
                        </span>
                        <span className="text-[9px] text-monad-400 font-semibold uppercase tracking-wide">
                          {priceAnago ? "ANAGO" : nft.paymentSymbol}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
        </div>
      </section>

      {/* ── Feature strips ── */}
      <section className="border-t border-white/[0.04] bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Zap, label: "Ultra-Fast", desc: "Monad 10,000 TPS", color: "text-amber-400", bg: "bg-amber-500/10" },
            { icon: Shield, label: "Secure", desc: "OpenZeppelin contracts", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: Globe, label: "Decentralized", desc: "IPFS file storage", color: "text-cyan-400", bg: "bg-cyan-500/10" },
            { icon: TrendingUp, label: "ANAGO Token", desc: "Native marketplace currency", color: "text-monad-400", bg: "bg-monad-500/10" },
          ].map(({ icon: Icon, label, desc, color, bg }) => (
            <div
              key={label}
              className="flex items-center gap-4 bg-[#111111] border border-white/[0.05] rounded-2xl p-4 hover:border-white/[0.1] transition-colors duration-200"
            >
              <div className={`${bg} p-2.5 rounded-xl flex-shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-gray-600 text-[11px] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
