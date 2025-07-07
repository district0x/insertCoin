import { useState, useEffect, useCallback } from "react";
import { useWalletConnection } from "./useWalletConnection";

interface UseDiscordLinkReturn {
    hasLinkedDiscordId: boolean | null;
    isLoading: boolean;
    error: string | null;
    checkDiscordLink: () => Promise<void>;
}

export function useDiscordLink(): UseDiscordLinkReturn {
    const { address } = useWalletConnection();
    const [hasLinkedDiscordId, setHasLinkedDiscordId] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkDiscordLink = useCallback(async () => {
        if (!address) {
            setHasLinkedDiscordId(null);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/user/has-linked-discord", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ walletAddress: address }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to check Discord link");
            }

            const data = await response.json();
            setHasLinkedDiscordId(data.hasLinkedDiscordId);
        } catch (err) {
            console.error("Error checking Discord link:", err);
            setError(err instanceof Error ? err.message : "Failed to check Discord link");
            setHasLinkedDiscordId(null);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    // Check Discord link when wallet address changes
    useEffect(() => {
        checkDiscordLink();
    }, [checkDiscordLink]);

    return {
        hasLinkedDiscordId,
        isLoading,
        error,
        checkDiscordLink,
    };
} 