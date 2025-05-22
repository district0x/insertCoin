// components/ImprovedWalletConnect.tsx - An enhanced wallet connection component that handles errors gracefully
'use client';

import { useState, useEffect } from 'react';
import {
    useAddress,
    useConnectionStatus,
    useDisconnect,
    useMetamask,
    useCoinbaseWallet,
    useWalletConnect
} from "@thirdweb-dev/react";

interface ImprovedWalletConnectProps {
    onConnect?: (address: string) => void;
    onDisconnect?: () => void;
    className?: string;
}

export function ImprovedWalletConnect({
    onConnect,
    onDisconnect,
    className = ''
}: ImprovedWalletConnectProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const disconnect = useDisconnect();

    // Connection methods
    const connectMetamask = useMetamask();
    const connectCoinbase = useCoinbaseWallet();
    const connectWalletConnect = useWalletConnect();

    // Handle connection status changes
    useEffect(() => {
        if (connectionStatus === "disconnected" && onDisconnect) {
            onDisconnect();
        } else if (connectionStatus === "connected" && address && onConnect) {
            onConnect(address);
        }
    }, [connectionStatus, address, onConnect, onDisconnect]);

    // Reset error when connection status changes
    useEffect(() => {
        if (connectionStatus === "connected") {
            setConnectionError(null);
        }
    }, [connectionStatus]);

    // Connect with error handling
    const handleConnect = async (
        connectMethod: () => Promise<any>,
        walletName: string
    ) => {
        try {
            setIsConnecting(true);
            setConnectionError(null);
            await connectMethod();
            setIsMenuOpen(false);
        } catch (err: any) {
            console.error(`${walletName} connection error:`, err);

            // Format user-friendly error message
            if (err.code === 4001) {
                setConnectionError("Connection rejected by user");
            } else if (err.message?.includes("already processing")) {
                setConnectionError("Connection already in progress");
            } else if (err.message?.includes("wallet_requestPermissions")) {
                // This is a MetaMask specific error - try to guide user
                setConnectionError("Please unlock your MetaMask wallet and try again");
            } else {
                setConnectionError(`${walletName} connection failed: ${err.message || "Unknown error"}`);
            }
        } finally {
            setIsConnecting(false);
        }
    };

    // Handle disconnect
    const handleDisconnect = async () => {
        try {
            await disconnect();
            setConnectionError(null);
        } catch (err: any) {
            console.error("Disconnect error:", err);
        }
    };

    // Format address for display
    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return (
        <div className={`relative ${className}`}>
            {address ? (
                <div className="flex items-center gap-2">
                    <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm border border-blue-100">
                        {formatAddress(address)}
                    </div>
                    <button
                        onClick={handleDisconnect}
                        className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-full hover:bg-red-100 border border-red-100"
                        disabled={connectionStatus === "disconnecting"}
                    >
                        {connectionStatus === "disconnecting" ? "Disconnecting..." : "Disconnect"}
                    </button>
                </div>
            ) : (
                <div>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        disabled={isConnecting || connectionStatus === "connecting"}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-70"
                    >
                        {isConnecting || connectionStatus === "connecting"
                            ? "Connecting..."
                            : "Connect Wallet"}
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                            <div className="py-1 divide-y divide-gray-100" role="menu">
                                <div className="px-4 py-2 text-sm text-gray-700 font-medium">
                                    Select Wallet
                                </div>
                                <button
                                    onClick={() => handleConnect(connectMetamask, "MetaMask")}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                                    role="menuitem"
                                >
                                    <span className="mr-2">🦊</span> MetaMask
                                </button>
                                <button
                                    onClick={() => handleConnect(connectCoinbase, "Coinbase")}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                                    role="menuitem"
                                >
                                    <span className="mr-2">🪙</span> Coinbase Wallet
                                </button>
                                <button
                                    onClick={() => handleConnect(connectWalletConnect, "WalletConnect")}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                                    role="menuitem"
                                >
                                    <span className="mr-2">🔗</span> WalletConnect
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {connectionError && (
                <div className="absolute right-0 mt-1 w-64 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-200">
                    {connectionError}
                </div>
            )}
        </div>
    );
}