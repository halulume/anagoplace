"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useReadContract, usePublicClient } from "wagmi";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  COLLECTION_ABI,
  type Listing,
} from "@/lib/contracts";
import { fetchNFTMetadata } from "@/lib/ipfs";
import NFTCard from "@/components/NFTCard";
import { getRarity, type Rarity } from "@/lib/rarity";
import { Search, Grid3X3, LayoutList, Loader2 } from "lucide-react";

type RarityTab = "All" | Rarity;
const VALID_RARITY_TABS: readonly RarityTab[] = ["All", "Basic", "Rare", "Epic", "Legendary", "Mystic"];

interface OnchainNFT {
  source: "onchain";
  collection: string;
  tokenId: number;
  name: string;
  image: string;
  owner: string;
  price?: bigint;
  listingId?: number;
  rarity: Rarity;
}

interface OpenSeaNFT {
  source: "opensea";
  collection: string; // slug
  collectionName: string;
  contract: string;
  tokenId: string;
  name: string;
  image: string | null;
  openseaUrl: string;
  rarity: Rarity;
}

type NFTItem = OnchainNFT | OpenSeaNFT;

export default function ExplorePage() {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const searchParams = useSearchParams();
  const publicClient = usePublicClient();

  // Rarity filter state comes from the sidebar (?rarity=Basic etc.)
  const rarityFromUrl = searchParams?.get("rarity");
  const rarityTab: RarityTab =
    rarityFromUrl && (VALID_RARITY_TABS as readonly string[]).includes(rarityFromUrl)
      ? (rarityFromUrl as RarityTab)
      : "All";

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

    // ── 1) On-chain AnagoPlace NFTs ──────────────────────────────
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
              source: "onchain",
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

    // ── 2) OpenSea Monad NFTs (all default to Basic rarity) ──────
    try {
      const res = await fetch("/api/opensea/explore?limit=150", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as {
          nfts?: Array<{
            tokenId: string;
            tokenName: string;
            image: string | null;
            collection: string;
            collectionName: string;
            contract: string;
            openseaUrl: string;
          }>;
        };
        for (const n of json.nfts ?? []) {
          items.push({
            source: "opensea",
            collection: n.collection,
            collectionName: n.collectionName,
            contract: n.contract,
            tokenId: n.tokenId,
            name: n.tokenName,
            image: n.image,
            openseaUrl: n.openseaUrl,
            rarity: "Basic", // external items have no engraved rarity
          });
        }
      }
    } catch {
      // OpenSea fetch is optional, don't fail the whole page
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
          {filtered.map((nft) => {
            if (nft.source === "onchain") {
              return (
                <NFTCard
                  key={`oc-${nft.collection}-${nft.tokenId}`}
                  collection={nft.collection}
                  tokenId={nft.tokenId}
                  name={nft.name}
                  image={nft.image}
                  owner={nft.owner}
                  price={nft.price}
                  listingId={nft.listingId}
                  rarity={nft.rarity}
                />
              );
            }
            // OpenSea external NFT — simple card linking out to OpenSea
            return (
              <a
                key={`os-${nft.collection}-${nft.tokenId}`}
                href={nft.openseaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-monad-500/20"
              >
                <div className="relative aspect-square bg-[#1a1a1a] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={nft.image || "/anago-hero.png"}
                    alt={nft.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/anago-hero.png";
                    }}
                  />
                  <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                    OpenSea
                  </span>
                  <span className="absolute top-2 right-2 bg-gradient-to-r from-gray-500 to-gray-400 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-lg">
                    Basic
                  </span>
                </div>
                <div className="p-3.5">
                  <h3 className="font-semibold text-white text-sm truncate">{nft.name}</h3>
                  <p className="text-gray-700 text-[10px] mt-0.5 truncate">
                    {nft.collectionName}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
