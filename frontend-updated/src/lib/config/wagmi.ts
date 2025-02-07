import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { baseSepolia } from "./chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "";

export const wagmiConfig = getDefaultConfig({
  appName: "OneVOne",
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});
