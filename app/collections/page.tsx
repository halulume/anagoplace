"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useReadContract } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/contracts";
import { Loader2, LayoutGrid, ArrowUpRight } from "lucide-react";
import { shortenAddress } from "@/lib/utils";

export default function CollectionsPage() {
  const [search, setSearch] = useState("");

  const { data: collections, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllCollections",
  });

  const filtered = (collections as `0x${string}`[] | undefined)?.filter((addr) =>
    addr.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Collections</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            {collections ? `${collections.length} collections on Monad` : "All NFT collections"}
          </p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-2 bg-monad-500/15 hover:bg-monad-500/25 border border-monad-500/25 text-monad-400 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
        >
          <LayoutGrid size={14} />
          Create Collection
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 size={32} className="text-monad-500 animate-spin" />
          <p className="text-gray-600 text-sm">Loading collections...</p>
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="text-center py-40">
          <div className="w-16 h-16 bg-[#111111] border border-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LayoutGrid size={24} className="text-gray-700" />
          </div>
          <p className="text-gray-500 text-xl font-bold mb-2">No collections yet</p>
          <p className="text-gray-700 text-sm mb-6">
            Be the first to create a collection on AnagoPlace!
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 bg-monad-500 hover:bg-monad-400 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 text-sm"
          >
            Create Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((addr) => (
            <Link
              key={addr}
              href={`/collection/${addr}`}
              className="group bg-[#111111] border border-white/[0.05] rounded-2xl overflow-hidden hover:border-monad-500/20 hover:shadow-[0_0_20px_rgba(131,110,249,0.08)] transition-all duration-300"
            >
              {/* Cover image placeholder */}
              <div className="relative h-32 bg-gradient-to-br from-monad-950 to-[#0d0d0d] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(131,110,249,0.15)_0%,transparent_70%)]" />
                <Image
                  src="/anago-hero.png"
                  alt="Collection"
                  fill
                  className="object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-300 group-hover:scale-105 transition-transform"
                />
              </div>

              {/* Avatar */}
              <div className="px-4 -mt-6 mb-3 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border-2 border-[#111111] overflow-hidden ring-1 ring-monad-500/20">
                  <Image
                    src="/anago-logo.png"
                    alt="Collection"
                    width={48}
                    height={48}
                    className="object-cover"
                  />
                </div>
              </div>

              <div className="px-4 pb-4">
                <p className="text-white font-bold text-sm truncate">
                  Collection
                </p>
                <p className="text-gray-700 text-[10px] font-mono truncate mt-0.5">
                  {shortenAddress(addr)}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                  <div className="text-[10px] text-gray-700 uppercase tracking-wider">
                    Monad Chain
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-monad-500 font-semibold group-hover:text-monad-400 transition-colors">
                    View
                    <ArrowUpRight size={11} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
