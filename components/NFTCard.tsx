"use client";

import Image from "next/image";
import Link from "next/link";
import { formatAnago, shortenAddress } from "@/lib/utils";
import { ipfsToHttp } from "@/lib/ipfs";
import { Tag, ArrowUpRight } from "lucide-react";
import { useMonPrice, formatUsd } from "@/lib/price";
import { formatUnits } from "viem";
import { getRarity, RARITY_CONFIG, type Rarity } from "@/lib/rarity";

interface NFTCardProps {
  collection: string;
  tokenId: number;
  name: string;
  image: string;
  owner: string;
  price?: bigint;
  listingId?: number;
  /** Pass the resolved rarity directly, or let the card infer it from attributes */
  rarity?: Rarity;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

// ANAGO / MON exchange rate for USD conversion.
// Set to a number once the pool is live; null hides the USD price.
const ANAGO_PER_MON: number | null = null;

export default function NFTCard({
  collection,
  tokenId,
  name,
  image,
  owner,
  price,
  rarity,
  attributes,
}: NFTCardProps) {
  const imgSrc = ipfsToHttp(image);
  const { price: monUsdPrice } = useMonPrice();

  // Resolve rarity — prop takes precedence, then attributes lookup, then Basic
  const cardRarity: Rarity = rarity ?? getRarity(attributes);
  const rarityConfig = RARITY_CONFIG[cardRarity];
  const isBasic = cardRarity === "Basic";

  // USD price estimate
  const anagoAmount = price ? parseFloat(formatUnits(price, 18)) : null;
  const usdPrice =
    anagoAmount && monUsdPrice && ANAGO_PER_MON
      ? (anagoAmount / ANAGO_PER_MON) * monUsdPrice
      : null;

  return (
    <Link href={`/nft/${collection}/${tokenId}`}>
      <div
        className={[
          "group relative bg-[#111111] border rounded-2xl overflow-hidden",
          "transition-all duration-300 hover:scale-[1.02] cursor-pointer",
          isBasic
            ? "border-white/[0.05] hover:border-monad-500/25 hover:shadow-[0_0_20px_rgba(131,110,249,0.1)]"
            : rarityConfig.cssClass,
        ].join(" ")}
      >
        {/* NFT image */}
        <div className="relative aspect-square overflow-hidden bg-[#1a1a1a]">
          <Image
            src={imgSrc}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.png";
            }}
          />

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* For Sale badge — top-left */}
          {price !== undefined && (
            <div className="absolute top-2.5 left-2.5 bg-monad-500/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg">
              <Tag size={9} />
              For Sale
            </div>
          )}

          {/* Rarity badge — top-right (always shown, neutral style for Basic) */}
          <div
            className={`absolute top-2.5 right-2.5 bg-gradient-to-r ${rarityConfig.badgeGradient} text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg uppercase tracking-wide`}
          >
            {rarityConfig.label}
          </div>

          {/* Quick-view arrow */}
          <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-1.5 border border-white/15">
              <ArrowUpRight size={13} className="text-white" />
            </div>
          </div>
        </div>

        {/* Card info */}
        <div className="p-3.5">
          <h3 className="font-semibold text-white truncate text-sm group-hover:text-monad-300 transition-colors duration-200">
            {name}
          </h3>
          <p className="text-gray-700 text-[10px] mt-0.5 truncate font-mono">
            {shortenAddress(owner)}
          </p>

          {price !== undefined && (
            <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex items-center justify-between">
              <div>
                <p className="text-[9px] text-gray-700 uppercase tracking-wider mb-0.5">
                  Price
                </p>
                <p className="text-white font-bold text-sm">
                  {formatAnago(price)}{" "}
                  <span className="text-gray-600 font-medium text-[10px]">
                    ANAGO
                  </span>
                </p>
                {usdPrice && (
                  <p className="text-gray-600 text-[10px] mt-0.5">
                    &asymp; {formatUsd(usdPrice)}
                  </p>
                )}
              </div>
              <div className="bg-monad-500/10 text-monad-400 text-xs px-3 py-1.5 rounded-xl font-semibold group-hover:bg-monad-500 group-hover:text-white transition-all duration-200 group-hover:shadow-[0_0_12px_rgba(131,110,249,0.4)]">
                Buy
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
