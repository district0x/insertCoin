import { defineChain } from "viem";

// Get RPC URLs from environment variables with fallbacks
const getRpcUrls = () => {
  const urls = [
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  ].filter(Boolean) as string[];

  if (urls.length === 0) {
    throw new Error('No RPC URL configured. Please set NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL in .env');
  }

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
