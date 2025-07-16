"use client";

import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { usePrivy } from "@privy-io/react-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, Wallet, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface WalletConnectionBannerProps {
    onDismiss?: () => void;
}

export function WalletConnectionBanner({ onDismiss }: WalletConnectionBannerProps) {
    const { isConnected, isExternalWallet, connect } = useWalletConnection();
    const { ready } = usePrivy();
    const [isDismissed, setIsDismissed] = useState(false);

    // Don't show if not ready, already connected with external wallet, or dismissed
    if (!ready || (isConnected && isExternalWallet) || isDismissed) {
        return null;
    }

    const handleDismiss = () => {
        setIsDismissed(true);
        onDismiss?.();
    };

    if (!isConnected) {
        return (
            <Alert className="mb-4 border-orange-200 bg-orange-50">
                <Wallet className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800">External Wallet Required</AlertTitle>
                <AlertDescription className="text-orange-700">
                    To create matches and perform transactions, you need to connect an external wallet like MetaMask.
                    <div className="mt-2 flex gap-2">
                        <Button
                            size="sm"
                            onClick={connect}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            Connect Wallet
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDismiss}
                            className="border-orange-300 text-orange-700 hover:bg-orange-100"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    if (isConnected && !isExternalWallet) {
        return (
            <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">External Wallet Recommended</AlertTitle>
                <AlertDescription className="text-yellow-700">
                    You're using an embedded wallet. For the best experience with transactions, we recommend connecting an external wallet like MetaMask.
                    <div className="mt-2 flex gap-2">
                        <Button
                            size="sm"
                            onClick={connect}
                            className="bg-yellow-600 hover:bg-yellow-700"
                        >
                            Connect External Wallet
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDismiss}
                            className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    return null;
} 