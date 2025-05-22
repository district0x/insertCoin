'use client';

import { SmartWallet } from "@thirdweb-dev/wallets";
import { BaseSepoliaTestnet } from "@thirdweb-dev/chains";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";

// Initialize a smart wallet
export async function getSmartWallet(personalWallet: any) {
    // Initialize the Smart Wallet
    const smartWallet = new SmartWallet({
        chain: BaseSepoliaTestnet,
        factoryAddress: process.env.NEXT_PUBLIC_SMART_WALLET_FACTORY_ADDRESS || '',
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '',
        gasless: true,
    });

    // Connect the smart wallet to the EOA
    await smartWallet.connect({
        personalWallet,
    });

    return smartWallet;
}

// Get smart wallet info for a connected wallet
export async function getWalletInfo(wallet: any) {
    if (!wallet) return null;

    const address = await wallet.getAddress();
    const chainId = await wallet.getChainId();
    const provider = wallet.getProvider();

    return {
        address,
        chainId,
        isSmartWallet: wallet.type === 'smart',
    };
}