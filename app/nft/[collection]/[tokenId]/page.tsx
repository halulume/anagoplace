"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { parseUnits } from "viem";
import {
  COLLECTION_ABI,
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  ANAGO_TOKEN_ADDRESS,
  ERC20_ABI,
  type Listing,
} from "@/lib/contracts";
import { fetchNFTMetadata, ipfsToHttp, type NFTMetadata } from "@/lib/ipfs";
import { formatAnago, shortenAddress } from "@/lib/utils";
import { getRarity, RARITY_CONFIG } from "@/lib/rarity";
import toast from "react-hot-toast";
import { Tag, ShoppingCart, X, Loader2, ExternalLink } from "lucide-react";

export default function NFTDetailPage() {
  const params = useParams();
  const collection = params.collection as `0x${string}`;
  const tokenId = BigInt(params.tokenId as string);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [owner, setOwner] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [listPrice, setListPrice] = useState("");
  const [showListModal, setShowListModal] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  // Get active listing
  const { data: listingRaw, refetch: refetchListing } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getListingByNFT",
    args: [collection, tokenId],
  });
  const listing = listingRaw as unknown as Listing | undefined;

  // Get Anago allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ANAGO_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address || "0x0000000000000000000000000000000000000000", MARKETPLACE_ADDRESS],
    query: { enabled: !!address },
  });

  useEffect(() => {
    loadNFT();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, tokenId, publicClient]);

  async function loadNFT() {
    if (!publicClient) return;
    try {
      const [tokenURI, ownerAddr] = await Promise.all([
        publicClient.readContract({
          address: collection,
          abi: COLLECTION_ABI,
          functionName: "tokenURI",
          args: [tokenId],
        }),
        publicClient.readContract({
          address: collection,
          abi: COLLECTION_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        }),
      ]);

      setOwner(ownerAddr as string);
      const meta = await fetchNFTMetadata(tokenURI as string);
      setMetadata(meta);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleList() {
    if (!listPrice || parseFloat(listPrice) <= 0) return toast.error("Please enter a price");
    setIsListing(true);
    const toastId = toast.loading("Listing for sale...");

    try {
      const price = parseUnits(listPrice, 18);

      // Approve marketplace for NFT
      toast.loading("Approving NFT...", { id: toastId });
      await writeContractAsync({
        address: collection,
        abi: COLLECTION_ABI,
        functionName: "setApprovalForAll",
        args: [MARKETPLACE_ADDRESS, true],
      });

      // List NFT
      toast.loading("Listing for sale...", { id: toastId });
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "listNFT",
        args: [collection, tokenId, price],
      });

      toast.success("Listed for sale!", { id: toastId });
      setShowListModal(false);
      setListPrice("");
      await refetchListing();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg.slice(0, 100), { id: toastId });
    } finally {
      setIsListing(false);
    }
  }

  async function handleBuy() {
    if (!listing || !listing.active) return;
    setIsBuying(true);
    const toastId = toast.loading("Processing purchase...");

    try {
      // Check/set allowance
      if (!allowance || allowance < listing.price) {
        toast.loading("Approving ANAGO token...", { id: toastId });
        await writeContractAsync({
          address: ANAGO_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [MARKETPLACE_ADDRESS, listing.price * BigInt(2)],
        });
        await refetchAllowance();
      }

      toast.loading("Buying NFT...", { id: toastId });
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buyNFT",
        args: [listing.id],
      });

      toast.success("NFT purchased!", { id: toastId });
      await loadNFT();
      await refetchListing();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg.slice(0, 100), { id: toastId });
    } finally {
      setIsBuying(false);
    }
  }

  async function handleCancel() {
    if (!listing) return;
    const toastId = toast.loading("Cancelling listing...");
    try {
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [listing.id],
      });
      toast.success("Listing cancelled", { id: toastId });
      await refetchListing();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg.slice(0, 100), { id: toastId });
    }
  }

  const isOwner = address && owner.toLowerCase() === address.toLowerCase();
  const isListed = listing && listing.active;

  // Rarity derived from loaded metadata
  const rarity = getRarity(metadata?.attributes ?? []);
  const rarityConfig = RARITY_CONFIG[rarity];
  const isBasic = rarity === "Basic";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={40} className="text-monad-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid lg:grid-cols-2 gap-10">
        {/* Image */}
        <div
          className={[
            "relative aspect-square rounded-3xl overflow-hidden bg-dark-200 border",
            isBasic ? "border-monad-500/10" : rarityConfig.cssClass,
          ].join(" ")}
        >
          {metadata?.image && (
            <Image
              src={ipfsToHttp(metadata.image)}
              alt={metadata.name || "NFT"}
              fill
              className="object-cover"
            />
          )}
          {/* Rarity badge overlay */}
          <div
            className={`absolute top-3 right-3 bg-gradient-to-r ${rarityConfig.badgeGradient} text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg uppercase tracking-wider`}
          >
            {rarityConfig.label}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-monad-400 text-sm font-medium mb-1">
              {shortenAddress(collection)}
            </p>
            <h1 className="text-3xl font-bold text-white">{metadata?.name || `#${tokenId}`}</h1>
            {metadata?.description && (
              <p className="text-gray-400 mt-3 leading-relaxed">{metadata.description}</p>
            )}
          </div>

          {/* Owner */}
          <div className="glass-card rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-1">Owner</p>
            <div className="flex items-center justify-between">
              <p className="text-white font-medium">{shortenAddress(owner)}</p>
              <a
                href={`https://monadscan.com/address/${owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-monad-400 hover:text-monad-300"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Price & Actions */}
          {isListed && (
            <div className="glass-card rounded-2xl p-5">
              <p className="text-gray-500 text-xs mb-1">Current Price</p>
              <p className="text-3xl font-bold text-white">
                {formatAnago(listing.price)}{" "}
                <span className="text-monad-400 text-xl">ANAGO</span>
              </p>

              {!isOwner && isConnected && (
                <button
                  onClick={handleBuy}
                  disabled={isBuying}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-monad-500 hover:bg-monad-400 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors"
                >
                  {isBuying ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                  {isBuying ? "Buying..." : "Buy Now"}
                </button>
              )}

              {isOwner && (
                <button
                  onClick={handleCancel}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold py-3 rounded-xl transition-colors"
                >
                  <X size={16} />
                  Cancel Listing
                </button>
              )}
            </div>
          )}

          {isOwner && !isListed && (
            <button
              onClick={() => setShowListModal(true)}
              className="flex items-center justify-center gap-2 bg-monad-500 hover:bg-monad-400 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              <Tag size={18} />
              List for Sale
            </button>
          )}

          {/* Attributes */}
          {metadata?.attributes && metadata.attributes.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3">Attributes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {metadata.attributes.map((attr, i) => (
                  <div key={i} className="bg-monad-500/10 border border-monad-500/20 rounded-xl p-3 text-center">
                    <p className="text-monad-400 text-xs">{attr.trait_type}</p>
                    <p className="text-white text-sm font-medium mt-0.5">{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-50 border border-monad-500/20 rounded-3xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">List for Sale</h3>
              <button onClick={() => setShowListModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="mb-5">
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">
                Price (ANAGO)
              </label>
              <input
                type="number"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.01"
                className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600"
              />
            </div>

            <button
              onClick={handleList}
              disabled={isListing}
              className="w-full flex items-center justify-center gap-2 bg-monad-500 hover:bg-monad-400 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              {isListing ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
              {isListing ? "Listing..." : "List for Sale"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
