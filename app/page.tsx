"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Zap, Shield, Globe, TrendingUp } from "lucide-react";
import { useReadContract } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI, MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "@/lib/contracts";
import { useState, useEffect } from "react";
import { useMonPrice, formatUsd } from "@/lib/price";

// Mock activity data (replace with on-chain events)
const MOCK_ACTIVITIES = [
  {
    id: 1,
    type: "SALE",
    name: "Anago #042",
    collection: "Anago OGs",
    price: "1,200",
    token: "ANAGO",
    change: "+18.4%",
    positive: true,
    image: "/anago-hero.png",
    time: "2 min ago",
  },
  {
    id: 2,
    type: "LIST",
    name: "Monad Punk #7",
    collection: "Monad Punks",
    price: "850",
    token: "ANAGO",
    change: "+5.2%",
    positive: true,
    image: "/anago-hero.png",
    time: "8 min ago",
  },
  {
    id: 3,
    type: "SALE",
    name: "Anago #118",
    collection: "Anago OGs",
    price: "2,400",
    token: "ANAGO",
    change: "+42.6%",
    positive: true,
    image: "/anago-hero.png",
    time: "15 min ago",
  },
  {
    id: 4,
    type: "SALE",
    name: "Monad Genesis #3",
    collection: "Genesis",
    price: "620",
    token: "ANAGO",
    change: "-3.1%",
    positive: false,
    image: "/anago-hero.png",
    time: "23 min ago",
  },
  {
    id: 5,
    type: "LIST",
    name: "Anago #201",
    collection: "Anago OGs",
    price: "980",
    token: "ANAGO",
    change: "+11.0%",
    positive: true,
    image: "/anago-hero.png",
    time: "31 min ago",
  },
];

// Mock trending NFTs — rarity matches the 5-tier system
const MOCK_TRENDING = [
  { id: 1, name: "Anago #001", collection: "Anago OGs", price: "3,200", rarity: "Legendary", image: "/anago-hero.png" },
  { id: 2, name: "Anago #007", collection: "Anago OGs", price: "1,800", rarity: "Epic", image: "/anago-hero.png" },
  { id: 3, name: "Monad Punk #1", collection: "Monad Punks", price: "950", rarity: "Rare", image: "/anago-hero.png" },
  { id: 4, name: "Genesis #0", collection: "Genesis", price: "5,500", rarity: "Mystic", image: "/anago-hero.png" },
  { id: 5, name: "Anago #042", collection: "Anago OGs", price: "1,200", rarity: "Basic", image: "/anago-hero.png" },
];

// Badge gradient per rarity tier (matches lib/rarity.ts)
const RARITY_BADGE: Record<string, string> = {
  Basic: "from-gray-500 to-gray-400",
  Rare: "from-blue-500 to-cyan-400",
  Epic: "from-purple-500 to-violet-500",
  Legendary: "from-orange-400 to-amber-500",
  Mystic: "from-red-500 to-rose-500",
};

// Card CSS class per rarity tier (matches globals.css .rarity-* rules)
const RARITY_CLASS: Record<string, string> = {
  Basic: "border-white/[0.05]",
  Rare: "rarity-rare border",
  Epic: "rarity-epic border",
  Legendary: "rarity-legendary border",
  Mystic: "rarity-mystic border",
};

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

  const [heroIndex, setHeroIndex] = useState(0);
  const heroItems = [
    { title: "Anago OGs", sub: "The original Anago dog collection on Monad", badge: "FEATURED" },
    { title: "Monad Punks", sub: "Pixel-art punks minted on Monad testnet", badge: "TRENDING" },
    { title: "Genesis Pass", sub: "Exclusive genesis NFTs for early adopters", badge: "LIMITED" },
  ];

  useEffect(() => {
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % heroItems.length), 5000);
    return () => clearInterval(t);
  }, []);

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

      {/* ── Hero / Carousel ── */}
      <section className="relative overflow-hidden">
        {/* Background image with overlay */}
        <div className="relative h-[420px] sm:h-[480px]">
          {/* Animated gradient bg */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0020] via-[#0a0a0a] to-[#000d1a]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_40%,rgba(131,110,249,0.15)_0%,transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_80%,rgba(0,212,255,0.08)_0%,transparent_60%)]" />

          {/* Content */}
          <div className="relative h-full max-w-7xl mx-auto px-6 flex items-center gap-8">
            {/* Left: text */}
            <div className="flex-1 max-w-xl">
              <span className="inline-flex items-center gap-2 bg-monad-500/10 border border-monad-500/20 rounded-full px-3 py-1 text-[11px] font-semibold text-monad-300 mb-5 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-monad-400 animate-pulse" />
                {heroItems[heroIndex].badge}
              </span>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-3 tracking-tight">
                {heroItems[heroIndex].title}
              </h1>
              <p className="text-gray-400 text-base sm:text-lg mb-8 leading-relaxed">
                {heroItems[heroIndex].sub}
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/explore"
                  className="flex items-center gap-2 bg-monad-500 hover:bg-monad-400 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 text-sm shadow-[0_0_20px_rgba(131,110,249,0.3)] hover:shadow-[0_0_30px_rgba(131,110,249,0.5)] hover:scale-[1.02]"
                >
                  Explore
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/create"
                  className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 text-sm hover:scale-[1.02]"
                >
                  Create NFT
                </Link>
              </div>

              {/* Carousel dots */}
              <div className="flex items-center gap-2 mt-8">
                {heroItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHeroIndex(i)}
                    className={`transition-all duration-300 rounded-full ${
                      i === heroIndex
                        ? "w-6 h-1.5 bg-monad-400"
                        : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right: Anago mascot */}
            <div className="hidden lg:flex flex-shrink-0 items-center justify-center">
              <div className="relative w-72 h-72">
                <div className="absolute inset-0 bg-monad-500/10 rounded-full blur-[60px] animate-pulse" />
                <div className="absolute inset-[-8%] border border-monad-500/10 rounded-full animate-spin-slow" />
                <div className="absolute inset-[8%] border border-cyan-500/5 rounded-full animate-spin-slow" style={{ animationDirection: "reverse" }} />
                <Image
                  src="/anago-hero.png"
                  alt="Anago Mascot"
                  fill
                  className="object-contain animate-float drop-shadow-[0_0_40px_rgba(131,110,249,0.25)]"
                  priority
                />
                {/* Price badge */}
                <div className="absolute bottom-4 right-0 translate-x-4 bg-gradient-to-r from-monad-500 to-accent-pink text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg">
                  <div className="text-[10px] opacity-80 mb-0.5">TOP PRICE</div>
                  <div className="text-base font-black">5,500 ANAGO</div>
                </div>
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
          <h2 className="text-lg font-bold text-white">Latest Activities</h2>
          <Link
            href="/explore"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>

        {/* Horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {MOCK_ACTIVITIES.map((item) => (
            <Link
              key={item.id}
              href="/explore"
              className="flex-shrink-0 w-[220px] bg-[#111111] border border-white/[0.05] rounded-2xl p-3 hover:border-monad-500/20 hover:bg-[#141414] transition-all duration-200 group"
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-[#1a1a1a]">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Type badge */}
                <span
                  className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                    item.type === "SALE"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {item.type}
                </span>
              </div>
              <p className="text-white font-semibold text-sm truncate">{item.name}</p>
              <p className="text-gray-600 text-[11px] truncate mb-2">{item.collection}</p>
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-bold">{item.price}</span>
                <span
                  className={`text-xs font-semibold ${
                    item.positive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {item.change}
                </span>
              </div>
              <p className="text-gray-700 text-[10px] mt-1">{item.time}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Trending NFTs ── */}
      <section className="max-w-7xl mx-auto px-6 py-4 pb-16">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Trending NFTs</h2>
          <Link
            href="/explore"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {MOCK_TRENDING.map((nft) => (
            <Link
              key={nft.id}
              href="/explore"
              className={`group relative bg-[#111111] rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] ${RARITY_CLASS[nft.rarity]}`}
            >
              {/* Image */}
              <div className="relative aspect-square bg-[#1a1a1a] overflow-hidden">
                <Image
                  src={nft.image}
                  alt={nft.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Rarity badge */}
                <div
                  className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${RARITY_BADGE[nft.rarity]} text-white shadow-lg uppercase tracking-wide`}
                >
                  {nft.rarity}
                </div>
                {/* Quick view overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="bg-white/10 backdrop-blur-sm rounded-full p-2 border border-white/20">
                    <ArrowUpRight size={16} className="text-white" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-white text-xs font-semibold truncate">{nft.name}</p>
                <p className="text-gray-600 text-[10px] truncate mb-2">{nft.collection}</p>
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-bold">{nft.price}</span>
                  <span className="text-[9px] text-gray-700 uppercase tracking-wide">ANAGO</span>
                </div>
              </div>
            </Link>
          ))}
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
