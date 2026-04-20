import type { Metadata } from "next";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import CacheBuster from "@/components/CacheBuster";
import { Toaster } from "react-hot-toast";

// Build-time timestamp — changes with every deploy, drives client-side cache purge
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

export const metadata: Metadata = {
  title: "AnagoPlace — Monad NFT Marketplace",
  description:
    "AnagoPlace. The premier NFT Marketplace on Monad. Create, mint, and trade NFTs with ANAGO token.",
  openGraph: {
    title: "AnagoPlace — Monad NFT Marketplace",
    description: "The premier NFT Marketplace on Monad. Powered by ANAGO token.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] min-h-screen">
        <CacheBuster buildId={BUILD_ID} />
        <WalletProvider>
          {/* Sidebar (left, fixed) */}
          <Sidebar />
          {/* Top bar (right of sidebar, fixed) */}
          <TopBar />
          {/* Main content: offset left by sidebar width + top by topbar height */}
          <main className="ml-[64px] mt-14 min-h-[calc(100vh-56px)]">
            {children}
          </main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#141414",
                color: "#fff",
                border: "1px solid rgba(131,110,249,0.18)",
                borderRadius: "12px",
                fontSize: "13px",
              },
              success: {
                iconTheme: { primary: "#836EF9", secondary: "#fff" },
              },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}
