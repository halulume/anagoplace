"use client";

import { useState, useEffect, useRef } from "react";
import { useReadContract, usePublicClient } from "wagmi";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  COLLECTION_ABI,
  type Listing,
} from "@/lib/contracts";
import { fetchNFTMetadata, ipfsToHttp } from "@/lib/ipfs";
import NFTCard from "@/components/NFTCard";
import { getRarity, RARITY_CONFIG, type Rarity } from "@/lib/rarity";
import { Search, Grid3X3, LayoutList, Loader2, Filter, ChevronDown, Check } from "lucide-react";

type RarityTab = "All" | Rarity;
const RARITY_TABS: RarityTab[] = ["All", "Basic", "Rare", "Epic", "Legendary", "Mystic"];

interface NFTItem {
  collection: string;
  tokenId: number;
  name: string;
  image: string;
  owner: string;
  price?: bigint;
  listingId?: number;
  rarity: Rarity;
}

export default function ExplorePage() {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [rarityTab, setRarityTab] = useState<RarityTab>("All");
  const [rarityOpen, setRarityOpen] = useState(false);
  const rarityRef = useRef<HTMLDivElement>(null);
  const publicClient = usePublicClient();

  // Close dropdown on outside click / ESC
  useEffect(() => {
    if (!rarityOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rarityRef.current && !rarityRef.current.contains(e.target as Node)) {
        setRarityOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRarityOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [rarityOpen]);

  // Counts per rarity (for tab badges)
  const rarityCounts: Record<RarityTab, number> = {
    All: nfts.length,
    Basic: nfts.filter((n) => n.rarity === "Basic").length,
    Rare: nfts.filter((n) => n.rarity === "Rare").length,
    Epic: nfts.filter((n) => n.rarity === "Epic").length,
    Legendary: nfts.filter((n) => n.rarity === "Legendary").length,
    Mystic: nfts.filter((n) => n.rarity === "Mystic").length,
  };

  const { data: collections } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllCollections",
  });

  const { data: listingsData } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getActiveListings",
    args: [BigInt(0), BigInt(100)],
  });

  useEffect(() => {
    if (!collections || !publicClient) return;
    loadNFTs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, listingsData, publicClient]);

  async function loadNFTs() {
    if (!collections || !publicClient) return;
    setLoading(true);

    const activeListings = listingsData ? (listingsData as unknown as [Listing[], bigint])[0] : [];
    const listingMap = new Map<string, { price: bigint; id: number }>();
    for (const listing of activeListings) {
      if (listing.active) {
        const key = `${listing.collection}-${listing.tokenId}`;
        listingMap.set(key, { price: listing.price, id: Number(listing.id) });
      }
    }

    const items: NFTItem[] = [];

    for (const collectionAddr of collections.slice(0, 20)) {
      try {
        const totalMinted = await publicClient.readContract({
          address: collectionAddr as `0x${string}`,
          abi: COLLECTION_ABI,
          functionName: "totalMinted",
        });

        const count = Math.min(Number(totalMinted), 10);
        for (let tokenId = 1; tokenId <= count; tokenId++) {
          try {
            const [tokenURI, owner] = await Promise.all([
              publicClient.readContract({
                address: collectionAddr as `0x${string}`,
                abi: COLLECTION_ABI,
                functionName: "tokenURI",
                args: [BigInt(tokenId)],
              }),
              publicClient.readContract({
                address: collectionAddr as `0x${string}`,
                abi: COLLECTION_ABI,
                functionName: "ownerOf",
                args: [BigInt(tokenId)],
              }),
            ]);

            const metadata = await fetchNFTMetadata(tokenURI as string);
            const key = `${collectionAddr}-${tokenId}`;
            const listing = listingMap.get(key);

            items.push({
              collection: collectionAddr,
              tokenId,
              name: metadata?.name || `#${tokenId}`,
              image: metadata?.image || "",
              owner: owner as string,
              price: listing?.price,
              listingId: listing?.id,
              rarity: getRarity(metadata?.attributes ?? []),
            });
          } catch {
            // skip token
          }
        }
      } catch {
        // skip collection
      }
    }

    setNfts(items);
    setLoading(false);
  }

  const filtered = nfts.filter((n) => {
    if (rarityTab !== "All" && n.rarity !== rarityTab) return false;
    if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Explore NFTs</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            {rarityTab === "All"
              ? `${nfts.length} NFTs across all collections`
              : `${filtered.length} ${rarityTab} NFTs`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search NFTs..."
              className="bg-[#111111] border border-white/[0.06] text-sm text-white placeholder-gray-700 rounded-xl pl-8 pr-4 py-2 focus:outline-none focus:border-monad-500/30 w-52"
            />
          </div>

          {/* View toggle */}
          <div className="flex bg-[#111111] rounded-xl border border-white/[0.05] p-1 gap-1">
            <button
              onClick={() => setView("grid")}
              className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-monad-500/20 text-monad-400" : "text-gray-600 hover:text-white"}`}
            >
              <Grid3X3 size={15} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-monad-500/20 text-monad-400" : "text-gray-600 hover:text-white"}`}
            >
              <LayoutList size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Rarity filter — collapsible dropdown */}
      <div className="relative mb-6 inline-block" ref={rarityRef}>
        <button
          onClick={() => setRarityOpen((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
            rarityTab === "All"
              ? "bg-[#111111] border border-white/[0.08] text-white hover:border-white/[0.16]"
              : `bg-gradient-to-r ${RARITY_CONFIG[rarityTab as Rarity].badgeGradient} text-white shadow-lg`
          }`}
        >
          <Filter size={13} />
          <span className="uppercase tracking-wider">
            {rarityTab === "All" ? "All Rarities" : rarityTab}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              rarityTab === "All" ? "bg-white/[0.06] text-gray-400" : "bg-black/25"
            }`}
          >
            {rarityCounts[rarityTab]}
          </span>
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${rarityOpen ? "rotate-180" : ""}`}
          />
        </button>

        {rarityOpen && (
          <div className="absolute left-0 top-full mt-2 w-56 bg-[#111111] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-30 animate-[fade-in_120ms_ease-out]">
            {RARITY_TABS.map((tab) => {
              const active = rarityTab === tab;
              const count = rarityCounts[tab];
              const dotColor =
                tab === "All"
                  ? "bg-gradient-to-r from-monad-500 to-accent-pink"
                  : `bg-gradient-to-r ${RARITY_CONFIG[tab].badgeGradient}`;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setRarityTab(tab);
                    setRarityOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold transition-colors ${
                    active ? "bg-white/[0.06] text-white" : "text-gray-400 hover:bg-white/[0.03] hover:text-white"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor} shadow-[0_0_6px_rgba(255,255,255,0.15)]`} />
                  <span className="flex-1 text-left uppercase tracking-wider">
                    {tab === "All" ? "All Rarities" : tab}
                  </span>
                  <span className="text-[10px] text-gray-600 font-bold">{count}</span>
                  {active && <Check size={12} className="text-monad-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 size={32} className="text-monad-500 animate-spin" />
          <p className="text-gray-600 text-sm">Loading NFTs from Monad...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-40">
          <p className="text-gray-500 text-xl font-bold mb-2">No NFTs found</p>
          <p className="text-gray-700 text-sm">
            Deploy contracts and create your first collection!
          </p>
        </div>
      ) : (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              : "flex flex-col gap-3"
          }
        >
          {filtered.map((nft) => (
            <NFTCard key={`${nft.collection}-${nft.tokenId}`} {...nft} />
          ))}
        </div>
      )}
    </div>
  );
}
