"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { shortenAddress } from "@/lib/utils";
import { Wallet, LogOut, ChevronDown, User, Copy, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function copyAddress() {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: injected() })}
        className="relative flex items-center gap-2 bg-gradient-to-r from-monad-500 to-monad-600 hover:from-monad-400 hover:to-monad-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 shadow-monad hover:shadow-monad-lg hover:scale-[1.02] active:scale-[0.98] btn-shimmer"
      >
        <Wallet size={16} />
        <span className="relative z-10">Connect Wallet</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-dark-100/80 border border-monad-500/20 hover:border-monad-500/40 text-white font-medium px-4 py-2.5 rounded-xl transition-all duration-300 hover:shadow-monad/10"
      >
        <div className="w-2 h-2 bg-emerald-400 rounded-full glow-dot text-emerald-400" />
        <span className="text-sm">{shortenAddress(address!)}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-dark-50/95 backdrop-blur-2xl border border-monad-500/15 rounded-2xl shadow-card overflow-hidden z-50 animate-scale-in">
          <div className="px-4 py-3 border-b border-white/[0.04]">
            <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-white font-mono">{shortenAddress(address!, 6)}</p>
              <button onClick={copyAddress} className="text-gray-500 hover:text-monad-400 transition-colors">
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
          <div className="p-1.5">
            <a
              href={`/profile/${address}`}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-monad-500/10 hover:text-white rounded-xl transition-all duration-200"
              onClick={() => setOpen(false)}
            >
              <User size={15} />
              My Profile
            </a>
            <button
              onClick={() => { disconnect(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
            >
              <LogOut size={15} />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
