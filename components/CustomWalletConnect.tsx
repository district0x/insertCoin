// components/CustomWalletConnect.tsx
'use client';

import { useMetamask, useCoinbaseWallet, useWalletConnect, useAddress, useDisconnect } from "@thirdweb-dev/react";
import { useState } from "react";

export function CustomWalletConnect() {
    const address = useAddress();
    const connectMetamask = useMetamask();
    const connectCoinbase = useCoinbaseWallet();
    const connectWalletConnect = useWalletConnect();
    const disconnect = useDisconnect();
    const [isOpen, setIsOpen] = useState(false);

    if (address) {
        return (
            <div className="flex items-center gap-2">
                <div className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                    {address.substring(0, 6)}...{address.substring(address.length - 4)}
                </div>
                <button
                    onClick={() => disconnect()}
                    className="text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
                Connect Wallet
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        <button
                            onClick={() => { connectMetamask(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                            role="menuitem"
                        >
                            MetaMask
                        </button>
                        <button
                            onClick={() => { connectCoinbase(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                            role="menuitem"
                        >
                            Coinbase Wallet
                        </button>
                        <button
                            onClick={() => { connectWalletConnect(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                            role="menuitem"
                        >
                            WalletConnect
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}