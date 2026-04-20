"use client";

/**
 * One-shot client-side cache purge.
 * Runs on every page load *very early* and:
 *   1. Unregisters any stale service worker (wagmi/WalletConnect may register one)
 *   2. Deletes all CacheStorage entries
 *   3. If the build ID differs from last seen, drops http cache by doing a
 *      one-time reload with `cache: "reload"` semantics
 *
 * This cannot rescue a tab that is so old it never re-fetches HTML, but the
 * next time the user hits F5 or opens a new tab, everything resets clean.
 */

import { useEffect } from "react";

export default function CacheBuster({ buildId }: { buildId: string }) {
  useEffect(() => {
    (async () => {
      try {
        // 1. Unregister service workers (if any)
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        }
        // 2. Clear all CacheStorage buckets
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
        }
        // 3. Build ID check — if changed, do one-time hard reload
        const KEY = "anagoplace:buildId";
        const prev = localStorage.getItem(KEY);
        if (prev && prev !== buildId) {
          localStorage.setItem(KEY, buildId);
          // Skip during a reload we triggered ourselves
          if (!sessionStorage.getItem("anagoplace:reloaded")) {
            sessionStorage.setItem("anagoplace:reloaded", "1");
            location.reload();
            return;
          }
        } else {
          localStorage.setItem(KEY, buildId);
        }
        sessionStorage.removeItem("anagoplace:reloaded");
      } catch {
        /* best-effort, never break the page */
      }
    })();
  }, [buildId]);

  return null;
}
