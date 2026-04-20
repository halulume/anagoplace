/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Image optimization allowlist ─────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "**.ipfs.dweb.link" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "spot.bean.exchange" },
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "assets.geckoterminal.com" },
      { protocol: "https", hostname: "assets.relay.link" },
      // OpenSea collection artwork hosts (all seadn.io subdomains)
      { protocol: "https", hostname: "**.seadn.io" },
      { protocol: "https", hostname: "seadn.io" },
      { protocol: "https", hostname: "openseauserdata.com" },
      { protocol: "https", hostname: "storage.opensea.io" },
      { protocol: "https", hostname: "imagedelivery.net" },
    ],
  },

  turbopack: {},
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],

  // ── Prevent Next.js from exposing the powered-by header ─────
  poweredByHeader: false,

  // ── React strict mode catches unsafe patterns early ─────────
  reactStrictMode: true,

  // ── Security headers ────────────────────────────────────────
  async headers() {
    // Content Security Policy — restrictive but compatible with wagmi/WalletConnect
    const csp = [
      "default-src 'self'",
      // Next.js dev needs unsafe-eval; prod-only would use 'self' but wagmi/viem
      // require eval for some WASM paths. Still blocks inline <script> from XSS.
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      [
        "img-src 'self' data: blob:",
        "https://ipfs.io",
        "https://gateway.pinata.cloud",
        "https://cloudflare-ipfs.com",
        "https://*.ipfs.dweb.link",
        "https://raw.githubusercontent.com",
        "https://spot.bean.exchange",
        "https://assets.coingecko.com",
        "https://coin-images.coingecko.com",
        "https://assets.geckoterminal.com",
        "https://assets.relay.link",
        // OpenSea image CDNs (all seadn.io subdomains: i, i2c, raw, etc.)
        "https://*.seadn.io",
        "https://seadn.io",
        "https://openseauserdata.com",
        "https://storage.opensea.io",
        "https://imagedelivery.net",
      ].join(" "),
      [
        "connect-src 'self'",
        "https://rpc.monad.xyz",
        "https://api.pinata.cloud",
        "https://gateway.pinata.cloud",
        "https://ipfs.io",
        "https://*.ipfs.dweb.link",
        "https://raw.githubusercontent.com",
        "https://api.coingecko.com",
        "https://assets.relay.link",
        "https://api.relay.link",
        // WalletConnect relay + Reown Cloud
        "wss://*.walletconnect.com",
        "wss://*.walletconnect.org",
        "wss://relay.walletconnect.com",
        "https://*.walletconnect.com",
        "https://*.walletconnect.org",
        "https://api.web3modal.org",
        "https://pulse.walletconnect.org",
        "https://explorer-api.walletconnect.com",
        "wss:",
      ].join(" "),
      "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          // HSTS — 1 year, include subdomains (HTTPS-only enforcement)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: csp },
          // Cross-origin isolation hardening
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        // Extra-strict cache headers for API routes
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
