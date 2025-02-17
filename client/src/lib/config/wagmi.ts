import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback } from "viem";
import { baseSepolia } from "./chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "";

// Create transport with optimized settings for Alchemy
const createTransport = (urls: string[]) => {
  return fallback(
    urls.map((url) =>
      http(url, {
        retryCount: 2,
        retryDelay: 1000,
        timeout: 30_000,
        batch: {
          batchSize: 1000,
          wait: 100,
        },
      })
    )
  );
};

export const wagmiConfig = getDefaultConfig({
  appName: "OneVOne",
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: createTransport(baseSepolia.rpcUrls.default.http),
  },
});
