"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowUpDown,
  Settings,
  Zap,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Info,
} from "lucide-react";
import { useAccount, useBalance, useWalletClient, usePublicClient } from "wagmi";

/** Token logo with graceful fallback to a colored initial circle */
function TokenLogo({ src, symbol, size = 24 }: { src: string; symbol: string; size?: number }) {
  const colors: Record<string, string> = {
    MON: "#836EF9",
    ANAGO: "#22c55e",
  };
  const bg = colors[symbol] ?? "#555";
  return (
    <div
      style={{ width: size, height: size, flexShrink: 0 }}
      className="relative rounded-full overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%" }}
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent && !parent.querySelector(".token-fallback")) {
            const fb = document.createElement("div");
            fb.className = "token-fallback";
            fb.style.cssText = `width:${size}px;height:${size}px;background:${bg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.max(size * 0.4, 8)}px;color:#fff;`;
            fb.textContent = symbol.charAt(0);
            parent.appendChild(fb);
          }
        }}
      />
    </div>
  );
}
import { parseUnits, formatUnits } from "viem";
import ConnectButton from "@/components/ConnectButton";
import { ANAGO_TOKEN_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import { useMonPrice, formatUsd } from "@/lib/price";

// ─────────────────────────────────────────────────────────────
// Token config
// ─────────────────────────────────────────────────────────────
const MON_TOKEN = {
  symbol: "MON",
  name: "Monad",
  address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  decimals: 18,
  // Official Monad logo via CoinGecko CDN
  logo: "https://coin-images.coingecko.com/coins/images/38927/large/monad.jpg",
};

const ANAGO_TOKEN = {
  symbol: "ANAGO",
  name: "Anago",
  address: ANAGO_TOKEN_ADDRESS,
  decimals: 18,
  // Locally hosted ANAGO logo (public/anago-logo.png)
  logo: "/anago-logo.png",
};

type Token = typeof MON_TOKEN | typeof ANAGO_TOKEN;
const SLIPPAGE_OPTIONS = [0.5, 1.0, 2.0];
const RELAY_APPROVAL = "0xccc88a9d1b4ed6b0eaba998850414b24f1c315be" as `0x${string}`;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface RelayTxData {
  from: string;
  to: string;
  data: string;
  value?: string;
  chainId: number;
  gas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}
interface RelayStep {
  id: string;
  action: string;
  description: string;
  kind: "transaction" | "signature";
  items: Array<{ status: string; data: RelayTxData; check?: { endpoint: string; method: string } }>;
}
interface RelayQuote {
  steps: RelayStep[];
  requestId: string;
  fees: {
    gas: { currency: { symbol: string }; amountFormatted: string; amountUsd: string };
  };
  details: {
    currencyIn: { amount: string; amountFormatted: string; amountUsd: string };
    currencyOut: { amount: string; amountFormatted: string; amountUsd: string; minimumAmount: string };
    rate: string;
    totalImpact: { percent: string };
    timeEstimate: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { price: monUsdPrice } = useMonPrice();

  const [fromToken, setFromToken] = useState<Token>(MON_TOKEN);
  const [toToken, setToToken] = useState<Token>(ANAGO_TOKEN);
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState(1.0);
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const [quote, setQuote] = useState<RelayQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteAge, setQuoteAge] = useState(0); // seconds since last quote

  const [swapStatus, setSwapStatus] = useState<"idle" | "approving" | "swapping" | "success" | "error">("idle");
  const [swapHash, setSwapHash] = useState<`0x${string}` | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  const activeSlippage = customSlippage ? parseFloat(customSlippage) : slippage;
  const quoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Balances
  const { data: monBalance, refetch: refetchMon } = useBalance({ address });
  const { data: anagoBalance, refetch: refetchAnago } = useBalance({ address, token: ANAGO_TOKEN_ADDRESS });

  const fromBalance = fromToken.symbol === "MON" ? monBalance?.formatted ?? "0" : anagoBalance?.formatted ?? "0";
  const toBalance   = toToken.symbol === "MON"   ? monBalance?.formatted ?? "0" : anagoBalance?.formatted ?? "0";

  // ── Allowance check (for ANAGO → MON)
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const fetchAllowance = useCallback(async () => {
    if (!address || fromToken.symbol !== "ANAGO" || !publicClient) return;
    try {
      const a = await publicClient.readContract({
        address: ANAGO_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, RELAY_APPROVAL],
      });
      setAllowance(a as bigint);
    } catch {}
  }, [address, fromToken.symbol, publicClient]);

  useEffect(() => { fetchAllowance(); }, [fetchAllowance]);

  const amountInBigInt = fromAmount && parseFloat(fromAmount) > 0
    ? parseUnits(fromAmount, 18) : BigInt(0);
  const needsApproval = fromToken.symbol === "ANAGO" && amountInBigInt > BigInt(0) && allowance < amountInBigInt;

  // ── Fetch Relay quote
  const fetchQuote = useCallback(async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    setQuoteAge(0);

    try {
      const body = {
        originChainId: 143,
        destinationChainId: 143,
        originCurrency: fromToken.address,
        destinationCurrency: toToken.address,
        amount: parseUnits(fromAmount, 18).toString(),
        user: address ?? "0x0000000000000000000000000000000000000001",
        recipient: address ?? "0x0000000000000000000000000000000000000001",
        tradeType: "EXACT_INPUT",
        slippageTolerance: (activeSlippage * 100).toString(), // basis points? or percent
      };

      const res = await fetch("/api/relay/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setQuoteError(data.message ?? data.error ?? "Failed to get quote");
        setQuote(null);
      } else {
        setQuote(data);
        // start age counter
        if (quoteTimerRef.current) clearInterval(quoteTimerRef.current);
        quoteTimerRef.current = setInterval(() => setQuoteAge((a) => a + 1), 1000);
      }
    } catch (e) {
      setQuoteError("Network error fetching quote");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [fromAmount, fromToken, toToken, address, activeSlippage]);

  // Debounce quote fetch
  useEffect(() => {
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  // Auto-refresh quote every 30s
  useEffect(() => {
    if (!quote) return;
    if (quoteAge >= 30) fetchQuote();
  }, [quoteAge, quote, fetchQuote]);

  useEffect(() => {
    return () => { if (quoteTimerRef.current) clearInterval(quoteTimerRef.current); };
  }, []);

  // ── Flip tokens
  const flipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(quote?.details?.currencyOut?.amountFormatted?.split(".").slice(0, 2).join(".").substring(0, 12) ?? "");
    setQuote(null);
  };

  // ── Approve ANAGO
  const handleApprove = async () => {
    if (!walletClient || !address) return;
    setSwapStatus("approving");
    setSwapError(null);
    try {
      const hash = await walletClient.writeContract({
        address: ANAGO_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [RELAY_APPROVAL, amountInBigInt * BigInt(100)],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await fetchAllowance();
      setSwapStatus("idle");
    } catch (e: unknown) {
      setSwapError((e as Error)?.message?.split("\n")[0] ?? "Approval failed");
      setSwapStatus("error");
    }
  };

  // ── Execute swap via Relay
  const handleSwap = async () => {
    if (!walletClient || !quote || !address) return;
    setSwapStatus("swapping");
    setSwapError(null);

    try {
      for (const step of quote.steps) {
        for (const item of step.items) {
          if (item.status === "incomplete") {
            const tx = item.data;
            const hash = await walletClient.sendTransaction({
              to: tx.to as `0x${string}`,
              data: tx.data as `0x${string}`,
              value: tx.value ? BigInt(tx.value) : undefined,
              gas: BigInt(tx.gas),
              maxFeePerGas: BigInt(tx.maxFeePerGas),
              maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas),
              chain: undefined, // uses current chain from wallet
            });
            setSwapHash(hash);
            await publicClient!.waitForTransactionReceipt({ hash });
          }
        }
      }
      setSwapStatus("success");
      setTimeout(() => {
        refetchMon();
        refetchAnago();
        setFromAmount("");
        setQuote(null);
        setSwapStatus("idle");
      }, 3000);
    } catch (e: unknown) {
      const msg = (e as Error)?.message?.split("\n")[0] ?? "Swap failed";
      setSwapError(msg.length > 80 ? msg.substring(0, 80) + "…" : msg);
      setSwapStatus("error");
    }
  };

  // ── Derived values
  const outFormatted = quote?.details?.currencyOut?.amountFormatted
    ? parseFloat(quote.details.currencyOut.amountFormatted).toLocaleString("en-US", { maximumFractionDigits: 4 })
    : null;
  const rate = quote?.details?.rate
    ? parseFloat(quote.details.rate).toLocaleString("en-US", { maximumFractionDigits: 4 })
    : null;
  const impact = quote?.details?.totalImpact?.percent ?? null;
  const gasFee = quote?.fees?.gas?.amountFormatted ?? null;
  const outUsd  = quote?.details?.currencyOut?.amountUsd  ? `$${parseFloat(quote.details.currencyOut.amountUsd).toFixed(4)}`  : null;
  const inUsd   = quote?.details?.currencyIn?.amountUsd   ? `$${parseFloat(quote.details.currencyIn.amountUsd).toFixed(4)}`   : null;
  const minOut  = quote?.details?.currencyOut?.minimumAmount
    ? parseFloat(formatUnits(BigInt(quote.details.currencyOut.minimumAmount), 18)).toLocaleString("en-US", { maximumFractionDigits: 4 })
    : null;

  const hasAmount = parseFloat(fromAmount || "0") > 0;
  const isHighImpact = impact ? parseFloat(impact) < -3 : false;

  // ── Render
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-10">
      <div className="max-w-5xl mx-auto mb-8">
        <h1 className="text-2xl font-black text-white mb-1">Swap</h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-sm text-gray-600">MON &harr; ANAGO &middot; Live Rate</p>
          {monUsdPrice && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-semibold">1 MON = {formatUsd(monUsdPrice)}</span>
            </div>
          )}
          {rate && (
            <div className="flex items-center gap-1.5 bg-monad-500/10 border border-monad-500/20 rounded-lg px-2.5 py-1">
              <span className="text-monad-400 text-xs font-semibold">
                1 {fromToken.symbol} = {rate} {toToken.symbol}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6 items-start">

        {/* ── Swap Card ── */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-3xl p-5 shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-base font-bold text-white">Swap Tokens</span>
            <div className="flex items-center gap-2">
              {quoteAge > 0 && (
                <span className={`text-[10px] font-mono ${quoteAge >= 25 ? "text-red-400" : "text-gray-600"}`}>
                  {30 - quoteAge}s
                </span>
              )}
              <button
                onClick={fetchQuote}
                disabled={!hasAmount}
                className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30"
                title="Refresh quote"
              >
                <RefreshCw size={14} className={quoteLoading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-all ${showSettings ? "bg-monad-500/15 text-monad-400" : "text-gray-600 hover:text-white hover:bg-white/[0.06]"}`}
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* Slippage */}
          {showSettings && (
            <div className="mb-4 bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Slippage Tolerance</p>
              <div className="flex items-center gap-2 flex-wrap">
                {SLIPPAGE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSlippage(s); setCustomSlippage(""); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${slippage === s && !customSlippage ? "bg-monad-500/20 text-monad-400 border border-monad-500/30" : "bg-white/[0.04] text-gray-500 border border-white/[0.05] hover:text-white"}`}
                  >
                    {s}%
                  </button>
                ))}
                <div className="relative">
                  <input
                    type="number"
                    value={customSlippage}
                    onChange={(e) => setCustomSlippage(e.target.value)}
                    placeholder="Custom"
                    className="w-20 bg-white/[0.04] border border-white/[0.06] rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-monad-500/30 text-right pr-5"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-600">%</span>
                </div>
              </div>
            </div>
          )}

          {/* FROM */}
          <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-4 mb-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-600 uppercase tracking-wider font-medium">You pay</span>
              <button
                onClick={() => setFromAmount(parseFloat(fromBalance).toFixed(6))}
                className="text-[11px] text-gray-600 hover:text-monad-400 transition-colors flex items-center gap-1"
              >
                Balance: <span className="text-gray-500">{parseFloat(fromBalance).toFixed(4)}</span>
                <span className="text-monad-500 font-semibold ml-0.5">MAX</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#1a1a1a] border border-white/[0.06] rounded-xl px-3 py-2 flex-shrink-0">
                <TokenLogo src={fromToken.logo} symbol={fromToken.symbol} size={24} />
                <span className="text-white font-bold text-sm">{fromToken.symbol}</span>
              </div>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => { setFromAmount(e.target.value); setSwapStatus("idle"); setSwapError(null); }}
                placeholder="0.0"
                className="flex-1 bg-transparent text-right text-2xl font-black text-white placeholder-gray-800 focus:outline-none min-w-0"
              />
            </div>
            {inUsd && fromAmount && (
              <p className="text-right text-[11px] text-gray-700 mt-1">≈ {inUsd}</p>
            )}
          </div>

          {/* Flip */}
          <div className="flex justify-center -my-0.5 z-10 relative">
            <button
              onClick={flipTokens}
              className="bg-[#111111] border border-white/[0.08] rounded-xl p-2 hover:bg-monad-500/10 hover:border-monad-500/30 text-gray-600 hover:text-monad-400 transition-all hover:scale-110 active:scale-95"
            >
              <ArrowUpDown size={16} />
            </button>
          </div>

          {/* TO */}
          <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-4 mt-1 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-600 uppercase tracking-wider font-medium">You receive</span>
              <span className="text-[11px] text-gray-600">
                Balance: <span className="text-gray-500">{parseFloat(toBalance).toFixed(4)}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#1a1a1a] border border-white/[0.06] rounded-xl px-3 py-2 flex-shrink-0">
                <TokenLogo src={toToken.logo} symbol={toToken.symbol} size={24} />
                <span className="text-white font-bold text-sm">{toToken.symbol}</span>
              </div>
              <div className="flex-1 text-right text-2xl font-black text-white flex items-center justify-end gap-2">
                {quoteLoading ? (
                  <Loader2 size={20} className="text-monad-500 animate-spin" />
                ) : outFormatted ? (
                  outFormatted
                ) : (
                  <span className="text-gray-800">0.0</span>
                )}
              </div>
            </div>
            {outUsd && outFormatted && (
              <p className="text-right text-[11px] text-gray-700 mt-1">≈ {outUsd}</p>
            )}
          </div>

          {/* Quote details */}
          {quote && hasAmount && !quoteLoading && (
            <div className="bg-[#0d0d0d] border border-white/[0.04] rounded-xl p-3.5 mb-4 space-y-2">
              {rate && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 flex items-center gap-1">Rate <Info size={11} className="text-gray-700" /></span>
                  <span className="text-gray-400">1 {fromToken.symbol} = {rate} {toToken.symbol}</span>
                </div>
              )}
              {gasFee && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Gas</span>
                  <span className="text-gray-400">{parseFloat(gasFee).toFixed(6)} MON</span>
                </div>
              )}
              {impact && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Price Impact</span>
                  <span className={parseFloat(impact) < -1 ? "text-amber-400" : "text-emerald-400"}>
                    {parseFloat(impact).toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Slippage</span>
                <span className="text-gray-400">{activeSlippage}%</span>
              </div>
              {minOut && (
                <div className="border-t border-white/[0.04] pt-2 flex justify-between text-xs">
                  <span className="text-gray-600">Min. received</span>
                  <span className="text-gray-300 font-medium">{minOut} {toToken.symbol}</span>
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {quoteError && hasAmount && (
            <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300/70">{quoteError}</p>
            </div>
          )}

          {swapError && (
            <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300/70">{swapError}</p>
            </div>
          )}

          {/* Success */}
          {swapStatus === "success" && swapHash && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-emerald-300 text-xs font-semibold">Swap successful!</p>
                <a
                  href={`https://monadvision.com/tx/${swapHash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-emerald-400/60 text-[11px] hover:text-emerald-400 flex items-center gap-1"
                >
                  View on explorer <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}

          {/* CTA */}
          {!isConnected ? (
            <div className="flex justify-center"><ConnectButton /></div>
          ) : !hasAmount ? (
            <button disabled className="w-full py-4 rounded-2xl bg-white/[0.05] text-gray-600 font-bold text-sm cursor-not-allowed">
              Enter an amount
            </button>
          ) : quoteLoading ? (
            <button disabled className="w-full py-4 rounded-2xl bg-white/[0.05] text-gray-600 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Getting quote…
            </button>
          ) : quoteError && !quote ? (
            <button disabled className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm cursor-not-allowed">
              Route not found
            </button>
          ) : needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={swapStatus === "approving"}
              className="w-full py-4 rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-300 font-bold text-sm hover:bg-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {swapStatus === "approving" ? <><Loader2 size={16} className="animate-spin" />Approving ANAGO…</> : "Approve ANAGO"}
            </button>
          ) : swapStatus === "swapping" ? (
            <button disabled className="w-full py-4 rounded-2xl bg-monad-500/20 text-monad-300 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Swapping…
            </button>
          ) : swapStatus === "success" ? (
            <button disabled className="w-full py-4 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> Done!
            </button>
          ) : isHighImpact ? (
            <button
              onClick={handleSwap}
              className="w-full py-4 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/30 transition-all"
            >
              ⚠ Swap Anyway (High Impact)
            </button>
          ) : (
            <button
              onClick={handleSwap}
              disabled={!quote}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-monad-500 to-monad-600 hover:from-monad-400 hover:to-monad-500 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(131,110,249,0.3)] hover:shadow-[0_0_30px_rgba(131,110,249,0.5)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Zap size={16} />
              Swap {fromToken.symbol} → {toToken.symbol}
            </button>
          )}
        </div>

        {/* ── Right panels ── */}
        <div className="space-y-4">

          {/* Token info */}
          <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-4">Token Info</p>

            {/* MON */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 ring-1 ring-monad-500/20 rounded-full">
                <TokenLogo src={MON_TOKEN.logo} symbol="MON" size={36} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">MON</p>
                <p className="text-gray-600 text-[10px]">Native · Monad</p>
              </div>
              <div className="text-right">
                {monUsdPrice ? (
                  <p className="text-white font-bold text-sm">{formatUsd(monUsdPrice)}</p>
                ) : (
                  <Loader2 size={12} className="text-gray-600 animate-spin" />
                )}
                <div className="flex items-center gap-1 justify-end">
                  <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-emerald-400 text-[10px]">Live</p>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-white/[0.04] my-3" />

            {/* ANAGO */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 ring-1 ring-monad-500/20 rounded-full">
                <TokenLogo src={ANAGO_TOKEN.logo} symbol="ANAGO" size={36} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">ANAGO</p>
                <a
                  href={`https://monadvision.com/token/${ANAGO_TOKEN_ADDRESS}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-gray-600 text-[10px] font-mono hover:text-monad-400 flex items-center gap-0.5"
                >
                  {ANAGO_TOKEN_ADDRESS.slice(0, 6)}…{ANAGO_TOKEN_ADDRESS.slice(-4)}
                  <ExternalLink size={9} />
                </a>
              </div>
              {rate && (
                <div className="text-right">
                  <p className="text-white font-bold text-sm">
                    {monUsdPrice && rate
                      ? formatUsd(monUsdPrice / parseFloat(rate))
                      : "—"}
                  </p>
                  <p className="text-gray-600 text-[10px]">per ANAGO</p>
                </div>
              )}
            </div>
          </div>

          {/* Live rate card */}
          {quote && rate && (
            <div className="bg-[#111111] border border-monad-500/15 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Live Rate</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-[10px]">
                    {quoteAge < 30 ? `${30 - quoteAge}s refresh` : "Refreshing..."}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TokenLogo src={fromToken.logo} symbol={fromToken.symbol} size={28} />
                  <span className="text-white font-bold text-sm">1 {fromToken.symbol}</span>
                </div>
                <span className="text-gray-600 text-xs">=</span>
                <div className="flex items-center gap-2">
                  <span className="text-monad-300 font-bold text-sm">{rate} {toToken.symbol}</span>
                  <TokenLogo src={toToken.logo} symbol={toToken.symbol} size={28} />
                </div>
              </div>
              {inUsd && outUsd && (
                <p className="text-center text-gray-700 text-[10px] mt-2">
                  {inUsd} → {outUsd}
                </p>
              )}
            </div>
          )}

          {/* My balances */}
          {isConnected && (
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">My Balances</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TokenLogo src={MON_TOKEN.logo} symbol="MON" size={24} />
                    <span className="text-gray-400 text-sm">MON</span>
                  </div>
                  <span className="text-white font-bold text-sm">{parseFloat(monBalance?.formatted ?? "0").toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TokenLogo src={ANAGO_TOKEN.logo} symbol="ANAGO" size={24} />
                    <span className="text-gray-400 text-sm">ANAGO</span>
                  </div>
                  <span className="text-white font-bold text-sm">{parseFloat(anagoBalance?.formatted ?? "0").toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
