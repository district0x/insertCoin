import { defineChain } from "viem";

// Get RPC URLs from environment variables with fallbacks
const getRpcUrls = () => {
  const urls = [
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
    "https://sepolia.base.org",
    "https://1rpc.io/base-sepolia",
    "https://base-sepolia.blockpi.network/v1/rpc/public",
  ].filter(Boolean) as string[];

  return {
    http: urls,
  };
};

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
  },
  rpcUrls: {
    default: getRpcUrls(),
    public: getRpcUrls(),
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
});
