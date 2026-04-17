"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { usePublicClient, useReadContract } from "wagmi";
import { COLLECTION_ABI, MARKETPLACE_ADDRESS, MARKETPLACE_ABI, type Listing } from "@/lib/contracts";
import { fetchNFTMetadata, ipfsToHttp } from "@/lib/ipfs";
import NFTCard from "@/components/NFTCard";
import { shortenAddress } from "@/lib/utils";
import { Loader2, ExternalLink } from "lucide-react";

interface NFTItem {
  collection: string;
  tokenId: number;
  name: string;
  image: string;
  owner: string;
  price?: bigint;
}

interface CollectionInfo {
  name: string;
  symbol: string;
  total: bigint;
  max: bigint;
  description: string;
  image: string;
  owner: string;
}

export default function CollectionPage() {
  const params = useParams();
  const collectionAddr = params.address as `0x${string}`;
  const publicClient = usePublicClient();

  const [info, setInfo] = useState<CollectionInfo | null>(null);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: listingsData } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getActiveListings",
    args: [BigInt(0), BigInt(200)],
  });

  useEffect(() => {
    if (publicClient) loadCollection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAddr, publicClient, listingsData]);

  async function loadCollection() {
    if (!publicClient) return;
    setLoading(true);

    try {
      const result = await publicClient.readContract({
        address: collectionAddr,
        abi: COLLECTION_ABI,
        functionName: "getCollectionInfo",
      }) as [string, string, bigint, bigint, string, string, string];

      setInfo({
        name: result[0],
        symbol: result[1],
        total: result[2],
        max: result[3],
        description: result[4],
        image: result[5],
        owner: result[6],
      });

      const activeListings = listingsData ? (listingsData as unknown as [Listing[], bigint])[0] : [];
      const listingMap = new Map<string, bigint>();
      for (const l of activeListings) {
        if (l.active && l.collection.toLowerCase() === collectionAddr.toLowerCase()) {
          listingMap.set(String(l.tokenId), l.price);
        }
      }

      const items: NFTItem[] = [];
      for (let id = 1; id <= Number(result[2]); id++) {
        try {
          const [ownerAddr, tokenURI] = await Promise.all([
            publicClient.readContract({ address: collectionAddr, abi: COLLECTION_ABI, functionName: "ownerOf", args: [BigInt(id)] }),
            publicClient.readContract({ address: collectionAddr, abi: COLLECTION_ABI, functionName: "tokenURI", args: [BigInt(id)] }),
          ]);

          const meta = await fetchNFTMetadata(tokenURI as string);
          items.push({
            collection: collectionAddr,
            tokenId: id,
            name: meta?.name || `#${id}`,
            image: meta?.image || "",
            owner: ownerAddr as string,
            price: listingMap.get(String(id)),
          });
        } catch { /* skip */ }
      }
      setNfts(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={40} className="text-monad-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Collection Banner */}
      <div className="relative rounded-3xl overflow-hidden mb-8 bg-dark-200 border border-monad-500/10">
        {info?.image && (
          <div className="relative h-48 w-full">
            <Image src={ipfsToHttp(info.image)} alt={info?.name || ""} fill className="object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-t from-dark to-transparent" />
          </div>
        )}
        <div className={`${info?.image ? "mt-0" : ""} p-8`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            {info?.image && (
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-4 border-dark bg-dark-200 shadow-monad -mt-12">
                <Image src={ipfsToHttp(info.image)} alt={info.name} fill className="object-cover" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">{info?.name}</h1>
                <span className="bg-monad-500/20 text-monad-300 text-xs px-2 py-1 rounded-lg font-mono">
                  {info?.symbol}
                </span>
              </div>
              {info?.description && (
                <p className="text-gray-400 mt-2 max-w-xl">{info.description}</p>
              )}
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{info?.total?.toString()}</p>
                <p className="text-gray-500 text-xs">Minted</p>
              </div>
              {info?.max !== BigInt(0) && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{info?.max?.toString()}</p>
                  <p className="text-gray-500 text-xs">Max</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-monad-500/10">
            <span className="text-gray-500 text-xs">Creator:</span>
            <a
              href={`/profile/${info?.owner}`}
              className="text-monad-400 text-xs hover:text-monad-300 font-mono"
            >
              {shortenAddress(info?.owner || "", 8)}
            </a>
            <a
              href={`https://monadscan.com/address/${collectionAddr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-400 ml-auto"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* NFTs */}
      <h2 className="text-xl font-bold text-white mb-5">
        NFT <span className="text-gray-500 font-normal text-base">({nfts.length})</span>
      </h2>

      {nfts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No NFTs in this collection
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {nfts.map((nft) => (
            <NFTCard key={`${nft.collection}-${nft.tokenId}`} {...nft} />
          ))}
        </div>
      )}
    </div>
  );
}
