"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";
import { Search, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/create", label: "Create" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-dark-50/90 backdrop-blur-2xl border-b border-monad-500/10 shadow-lg shadow-black/20"
          : "bg-transparent backdrop-blur-sm"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden group-hover:scale-105 transition-transform duration-300">
              <Image
                src="/anago-logo.png"
                alt="AnagoPlace"
                fill
                className="object-cover"
              />
            </div>
            <span className="font-bold text-white text-lg hidden sm:block tracking-tight">
              Anago<span className="text-monad-400">Place</span>
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1 bg-dark-100/50 backdrop-blur-sm rounded-xl p-1 border border-white/[0.04]">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 relative",
                  pathname === link.href
                    ? "bg-monad-500/20 text-monad-300 shadow-sm shadow-monad-500/10"
                    : "text-gray-500 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs hidden lg:block">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (search.trim()) router.push(`/explore?q=${search}`);
              }}
              className="relative group"
            >
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-monad-400 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collections, NFTs..."
                className="w-full bg-dark-100/60 border border-white/[0.06] text-sm text-white placeholder-gray-600 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-monad-500/30 focus:bg-dark-100 transition-all duration-300"
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
            <ConnectButton />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-gray-400 hover:text-white p-1"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-dark-50/95 backdrop-blur-2xl border-t border-white/[0.04] animate-slide-up">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-monad-500/15 text-monad-300"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
