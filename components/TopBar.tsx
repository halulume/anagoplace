"use client";

import { Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ConnectButton from "./ConnectButton";

export default function TopBar() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="fixed top-0 left-[64px] right-0 h-14 flex items-center px-5 gap-4 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.05] z-40">
      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (search.trim()) router.push(`/explore?q=${encodeURIComponent(search)}`);
        }}
        className="relative flex-1 max-w-sm group"
      >
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-monad-400 transition-colors pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search NFTs, collections, addresses..."
          className="w-full bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-gray-700 rounded-xl pl-8 pr-12 py-2 focus:outline-none focus:border-monad-500/25 focus:bg-white/[0.05] transition-all duration-200"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-700 border border-white/[0.07] rounded px-1.5 py-0.5 font-mono hidden sm:block">
          ⌘K
        </kbd>
      </form>

      {/* Right: Connect */}
      <div className="ml-auto flex items-center gap-3">
        {/* Monad live indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          Monad
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
