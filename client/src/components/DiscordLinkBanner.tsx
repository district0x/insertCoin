"use client";

import { useDiscordLink } from "@/lib/hooks/useDiscordLink";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, MessageCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface DiscordLinkBannerProps {
    onDismiss?: () => void;
}

export function DiscordLinkBanner({ onDismiss }: DiscordLinkBannerProps) {
    const { hasLinkedDiscordId, isLoading } = useDiscordLink();
    const { isConnected } = useWalletConnection();
    const [isDismissed, setIsDismissed] = useState(false);

    // Don't show if:
    // - Still loading Discord link status
    // - User already has linked Discord ID
    // - User is not connected
    // - Banner has been dismissed
    if (isLoading || hasLinkedDiscordId === true || !isConnected || isDismissed) {
        return null;
    }

    const handleDismiss = () => {
        setIsDismissed(true);
        onDismiss?.();
    };

    return (
        <Alert className="mb-4 border-blue-200 bg-blue-50">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Link Your Discord Account</AlertTitle>
            <AlertDescription className="text-blue-700">
                To create matches and participate in Discord-organized games, you need to link your Discord account to your wallet.
                <div className="mt-2 flex gap-2">
                    <Button
                        size="sm"
                        asChild
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Link href="/wallet-signature">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Link Discord
                        </Link>
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDismiss}
                        className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
} 