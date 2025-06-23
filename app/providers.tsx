// app/providers.tsx (updated)
'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig } from '@/lib/privy';

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
            <PrivyProvider
                appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
                config={{
                    ...privyConfig,
                    appearance: {
                        ...privyConfig.appearance,
                        showWalletLoginFirst: false,
                    },
                    embeddedWallets: {
                        ...privyConfig.embeddedWallets,
                        createOnLogin: 'all-users',
                    },
                }}
            >
                {children}
            </PrivyProvider>
        </QueryClientProvider>
    );
}