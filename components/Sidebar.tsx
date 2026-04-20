"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  Compass,
  PlusSquare,
  ArrowLeftRight,
  User,
  LayoutGrid,
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
          return (
            <div key={href} className="flex flex-col items-center w-full">
              <Link
                href={href}
                title={label}
                className={cn(
                  "group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  active
                    ? "bg-monad-500/15 text-monad-400"
                    : "text-gray-600 hover:text-gray-200 hover:bg-white/[0.06]"
                )}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-monad-400 rounded-r-full shadow-[0_0_8px_rgba(131,110,249,0.8)]" />
                )}
                <Icon
                  size={19}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {/* Tooltip */}
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#181818] text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 border border-white/[0.08] shadow-xl z-[60]">
                  {label}
                </span>
              </Link>

              {/* Explore sub-items — show only when Explore is active */}
              {href === "/explore" && exploreActive && (
                <div className="flex flex-col items-center gap-1 mt-1 mb-1 py-1 border-l border-white/[0.05]">
                  {EXPLORE_SUBS.map((s) => {
                    const selected = currentRarity === s.key;
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
