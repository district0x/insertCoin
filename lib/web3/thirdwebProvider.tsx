// lib/web3/thirdwebProvider.tsx
'use client';

import React from 'react';
import { ThirdwebProvider, smartWallet, metamaskWallet, coinbaseWallet, walletConnect } from "@thirdweb-dev/react";
import { Base, BaseSepoliaTestnet } from "@thirdweb-dev/chains";

// Factory address for your smart wallet implementation
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_SMART_WALLET_FACTORY_ADDRESS || '';

// Choose the active chain - use Base for production or BaseSepoliaTestnet for testing
const activeChain = process.env.NEXT_PUBLIC_NETWORK === 'production' ? Base : BaseSepoliaTestnet;

export function ThirdwebProviderWrapper({ children }: { children: React.ReactNode }) {
    return (
        <ThirdwebProvider
            clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
            activeChain={activeChain}
            supportedWallets={[
                smartWallet({
                    factoryAddress: FACTORY_ADDRESS,
                    gasless: true,
                }),
            ]}
        >
            {children}
        </ThirdwebProvider>
    );
}