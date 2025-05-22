// app/providers.tsx (updated)
'use client';

import React from 'react';
import { ThirdwebProvider, metamaskWallet, coinbaseWallet, walletConnect } from "@thirdweb-dev/react";
import { BaseSepoliaTestnet } from "@thirdweb-dev/chains";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a shared QueryClient instance that all components will use
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            staleTime: 60 * 1000, // 1 minute
        },
    },
});

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThirdwebProvider
                clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || ""}
                activeChain={BaseSepoliaTestnet}
                supportedWallets={[
                    metamaskWallet(),
                    coinbaseWallet(),
                    walletConnect()
                ]}
                queryClient={queryClient} // Pass the queryClient to ThirdwebProvider
            >
                {children}
            </ThirdwebProvider>
        </QueryClientProvider>
    );
}