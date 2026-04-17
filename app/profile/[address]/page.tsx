"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicClient, useReadContract } from "wagmi";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  COLLECTION_ABI,
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  type Listing,
} from "@/lib/contracts";
import { fetchNFTMetadata } from "@/lib/ipfs";
import NFTCard from "@/components/NFTCard";
import { shortenAddress } from "@/lib/utils";
import { Loader2, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";

interface NFTItem {
  collection: string;
  tokenId: number;
  name: string;
  image: string;
  owner: string;
  price?: bigint;
}

export default function ProfilePage() {
  const params = useParams();
  const userAddress = params.address as `0x${string}`;
  const publicClient = usePublicClient();

  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"owned" | "created">("owned");

  const { data: userCollections } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getUserCollections",
    args: [userAddress],
  });

  const { data: listingsData } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getActiveListings",
    args: [BigInt(0), BigInt(200)],
  });

  useEffect(() => {
    if (publicClient) loadOwnedNFTs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress, publicClient, userCollections, listingsData]);

  async function loadOwnedNFTs() {
    if (!publicClient) return;
    setLoading(true);

    const activeListings = listingsData ? (listingsData as unknown as [Listing[], bigint])[0] : [];
    const listingMap = new Map<string, bigint>();
    for (const l of activeListings) {
      if (l.active) listingMap.set(`${l.collection}-${l.tokenId}`, l.price);
    }

    const items: NFTItem[] = [];
    const allCollections = (userCollections as `0x${string}`[]) || [];

    for (const collAddr of allCollections) {
      try {
        const totalMinted = await publicClient.readContract({
          address: collAddr,
          abi: COLLECTION_ABI,
          functionName: "totalMinted",
        });

        for (let id = 1; id <= Number(totalMinted); id++) {
          try {
            const [ownerAddr, tokenURI] = await Promise.all([
              publicClient.readContract({ address: collAddr, abi: COLLECTION_ABI, functionName: "ownerOf", args: [BigInt(id)] }),
              publicClient.readContract({ address: collAddr, abi: COLLECTION_ABI, functionName: "tokenURI", args: [BigInt(id)] }),
            ]);

            if ((ownerAddr as string).toLowerCase() !== userAddress.toLowerCase()) continue;

            const meta = await fetchNFTMetadata(tokenURI as string);
            const key = `${collAddr}-${id}`;
            items.push({
              collection: collAddr,
              tokenId: id,
              name: meta?.name || `#${id}`,
              image: meta?.image || "",
              owner: ownerAddr as string,
              price: listingMap.get(key),
            });
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    setNfts(items);
    setLoading(false);
  }

  function copyAddress() {
    navigator.clipboard.writeText(userAddress);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Profile Header */}
      <div className="glass-card rounded-3xl p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-monad-gradient flex items-center justify-center shadow-monad-lg">
            <span className="text-3xl font-bold text-white">
              {userAddress.slice(2, 4).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{shortenAddress(userAddress, 6)}</h1>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mt-1 transition-colors"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              {userAddress}
            </button>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{nfts.length}</p>
              <p className="text-gray-500 text-xs">NFTs Owned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{userCollections?.length || 0}</p>
              <p className="text-gray-500 text-xs">Collections</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["owned", "created"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? "bg-monad-500 text-white" : "bg-dark-100 text-gray-500 hover:text-white"
            }`}
          >
            {t === "owned" ? "My NFTs" : "My Collections"}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={36} className="text-monad-500 animate-spin" />
        </div>
      ) : tab === "owned" ? (
        nfts.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            No NFTs owned
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {nfts.map((nft) => (
              <NFTCard key={`${nft.collection}-${nft.tokenId}`} {...nft} />
            ))}
          </div>
        )
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(userCollections || []).map((addr) => (
            <a
              key={addr}
              href={`/collection/${addr}`}
              className="glass-card rounded-2xl p-5 hover:border-monad-500/40 transition-colors"
            >
              <p className="text-monad-400 text-xs mb-1">Collection</p>
              <p className="text-white font-mono text-sm">{shortenAddress(addr as string, 8)}</p>
            </a>
          ))}
          {(!userCollections || userCollections.length === 0) && (
            <p className="text-gray-500 text-sm col-span-3 text-center py-12">
              No collections created
            </p>
          )}
        </div>
      )}
    </div>
  );
}
