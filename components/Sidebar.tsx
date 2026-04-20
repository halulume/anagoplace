"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  Compass,
  PlusSquare,
  ArrowLeftRight,
  User,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/create", icon: PlusSquare, label: "Create" },
  { href: "/swap", icon: ArrowLeftRight, label: "Swap" },
  { href: "/collections", icon: LayoutGrid, label: "Collections" },
  { href: "/profile", icon: User, label: "Profile" },
];

// Explore sub-items (rarity tiers). Rendered as mini dots under the compass
// icon whenever we're on /explore, collapsed otherwise.
const EXPLORE_SUBS: Array<{ key: string; label: string; gradient: string }> = [
  { key: "All", label: "All", gradient: "from-monad-500 to-accent-pink" },
  { key: "Basic", label: "Basic", gradient: "from-gray-500 to-gray-400" },
  { key: "Rare", label: "Rare", gradient: "from-blue-500 to-cyan-400" },
  { key: "Epic", label: "Epic", gradient: "from-purple-500 to-violet-500" },
  { key: "Legendary", label: "Legendary", gradient: "from-orange-400 to-amber-500" },
  { key: "Mystic", label: "Mystic", gradient: "from-red-500 to-rose-500" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const exploreActive = pathname === "/explore" || pathname.startsWith("/explore/");
  const currentRarity = searchParams?.get("rarity") ?? "All";

  // Sub-tab expansion is manual: start collapsed, toggle via compass click.
  // Persisted in localStorage so the choice survives navigation.
  const [exploreOpen, setExploreOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("anagoplace:exploreOpen");
      if (saved === "1") setExploreOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("anagoplace:exploreOpen", exploreOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [exploreOpen]);

  return (
    <aside className="fixed left-0 top-0 h-screen w-[64px] flex flex-col items-center bg-[#0a0a0a] border-r border-white/[0.05] z-50 py-4">
      {/* Logo */}
      <Link
        href="/"
        className="mb-8 mt-1 flex items-center justify-center group"
        title="AnagoPlace"
      >
        <div className="relative w-9 h-9 rounded-xl overflow-hidden group-hover:scale-105 transition-transform duration-300 ring-1 ring-monad-500/20 group-hover:ring-monad-500/50 group-hover:shadow-[0_0_16px_rgba(131,110,249,0.3)]">
          <Image
            src="/anago-logo.png"
            alt="AnagoPlace"
            fill
            className="object-cover"
          />
        </div>
      </Link>

      {/* Nav Icons */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href));
          const isExplore = href === "/explore";

          // Explore gets a button-wrapper that toggles sub-tabs and also
          // navigates. Everything else is a plain Link.
          const iconInner = (
            <>
              {/* Active indicator bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-monad-400 rounded-r-full shadow-[0_0_8px_rgba(131,110,249,0.8)]" />
              )}
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#181818] text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 border border-white/[0.08] shadow-xl z-[60]">
                {label}
              </span>
            </>
          );
          const iconClass = cn(
            "group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
            active
              ? "bg-monad-500/15 text-monad-400"
              : "text-gray-600 hover:text-gray-200 hover:bg-white/[0.06]"
          );

          return (
            <div key={href} className="flex flex-col items-center w-full">
              {isExplore ? (
                // Explore: Link that also toggles sub-tabs on click.
                // If already on /explore, click = pure toggle (preventDefault
                // the navigation to avoid a pointless same-page reload).
                <Link
                  href={href}
                  title={label}
                  className={iconClass}
                  onClick={(e) => {
                    if (exploreActive) {
                      e.preventDefault();
                      setExploreOpen((v) => !v);
                    } else {
                      setExploreOpen(true);
                    }
                  }}
                >
                  {iconInner}
                  {/* Tiny chevron cue — rotates when open */}
                  <ChevronDown
                    size={9}
                    className={cn(
                      "absolute -bottom-0.5 right-0.5 text-gray-600 transition-transform duration-200",
                      exploreOpen && "rotate-180 text-monad-400"
                    )}
                  />
                </Link>
              ) : (
                <Link href={href} title={label} className={iconClass}>
                  {iconInner}
                </Link>
              )}

              {/* Explore sub-items — only when user explicitly opened */}
              {isExplore && exploreOpen && (
                <div className="flex flex-col items-center gap-1 mt-1 mb-1 py-1 border-l border-white/[0.05] animate-[fade-in_140ms_ease-out]">
                  {EXPLORE_SUBS.map((s) => {
                    const selected = exploreActive && currentRarity === s.key;
                    const subHref =
                      s.key === "All" ? "/explore" : `/explore?rarity=${s.key}`;
                    return (
                      <Link
                        key={s.key}
                        href={subHref}
                        title={s.label}
                        className="group relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/[0.05] transition-colors"
                      >
                        <span
                          className={cn(
                            "w-2.5 h-2.5 rounded-full bg-gradient-to-r shadow-[0_0_6px_rgba(255,255,255,0.15)] transition-all duration-200",
                            s.gradient,
                            selected ? "ring-2 ring-white/70 scale-125" : "opacity-60 group-hover:opacity-100"
                          )}
                        />
                        <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#181818] text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 border border-white/[0.08] shadow-xl z-[60]">
                          {s.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto flex flex-col items-center gap-2 pb-1">
        <div className="w-5 h-px bg-white/[0.06]" />
        <span className="text-[9px] text-gray-800 font-mono tracking-widest rotate-0">
          v1.0
        </span>
      </div>
    </aside>
  );
}
