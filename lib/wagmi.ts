import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";

export const monadMainnet = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "143"),
  name: "Monad",
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.monad.xyz/"],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: "https://monadscan.com",
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [monadMainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "default",
    }),
  ],
  transports: {
    [monadMainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.monad.xyz"),
  },
});
