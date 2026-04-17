import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded-md overflow-hidden">
                <Image src="/anago-logo.png" alt="AnagoPlace" fill className="object-cover" />
              </div>
              <span className="font-bold text-white text-sm">
                Anago<span className="text-monad-400">Place</span>
              </span>
            </div>
            <p className="text-gray-600 text-xs max-w-xs text-center md:text-left">
              NFT Marketplace on Monad. Powered by ANAGO Token.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/explore" className="hover:text-monad-400 transition-colors">Explore</Link>
            <Link href="/create" className="hover:text-monad-400 transition-colors">Create</Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-700 text-xs">Powered by Monad & ANAGO</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
