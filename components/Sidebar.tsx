"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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

export default function Sidebar() {
  const pathname = usePathname();

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
            <Link
              key={href}
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
