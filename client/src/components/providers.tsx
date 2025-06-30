"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

// ClientOnly wrapper to prevent hydration mismatches
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClientOnly>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
        config={{
          loginMethods: [
            "email",
            "discord",
            "google",
            "wallet"
          ],
          appearance: {
            theme: "dark",
            accentColor: "#6366f1",
            showWalletLoginFirst: true,
          },
          defaultChain: {
            id: 84532,
            name: "Base Sepolia",
            rpcUrls: {
              default: {
                http: [process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || ""],
              },
            },
            blockExplorers: {
              default: {
                name: "Base Sepolia Explorer",
                url: "https://sepolia.basescan.org",
              },
            },
            nativeCurrency: {
              name: "Ethereum",
              symbol: "ETH",
              decimals: 18,
            },
          },
          supportedChains: [
            {
              id: 84532,
              name: "Base Sepolia",
              rpcUrls: {
                default: {
                  http: [process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || ""],
                },
              },
              blockExplorers: {
                default: {
                  name: "Base Sepolia Explorer",
                  url: "https://sepolia.basescan.org",
                },
              },
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
              },
            },
          ],
        }}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </PrivyProvider>
    </ClientOnly>
  );
}
