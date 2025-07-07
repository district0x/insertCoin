"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import MatchList from "@/components/match/match-list";
import { fetchMatch } from "@/lib/match/fetch";
import { WalletLinkBanner } from "@/components/WalletLinkBanner";
import { DiscordLinkBanner } from "@/components/DiscordLinkBanner";
import { useDiscordLink } from "@/lib/hooks/useDiscordLink";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";

export default function MatchesPage() {
  const contract = useContract();
  const { isConnected } = useWalletConnection();
  const { hasLinkedDiscordId, isLoading: isCheckingDiscord } = useDiscordLink();
  const [error, setError] = React.useState<string | null>(null);
  const [showWalletBanner, setShowWalletBanner] = React.useState(true);
  const [showDiscordBanner, setShowDiscordBanner] = React.useState(true);

  // Create a public client for reading contract state
  const publicClient = React.useMemo(() => {
    return createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
    });
  }, []);

  // Check if user needs to link Discord account
  const needsDiscordLink = React.useMemo(() => {
    // If we're still checking, don't show banner yet
    if (isCheckingDiscord) return false;

    // If user has linked Discord ID, don't show banner
    if (hasLinkedDiscordId === true) return false;

    // Show banner if user is connected but doesn't have linked Discord ID
    return isConnected && hasLinkedDiscordId === false;
  }, [isCheckingDiscord, hasLinkedDiscordId, isConnected]);

  // Debug contract address
  React.useEffect(() => {
    // Try to directly call nextMatchId
    if (contract) {
      publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "nextMatchId",
      }).then((result) => {
        console.log("Contract is working! nextMatchId:", result);
      }).catch((error) => {
        console.error("Contract call failed:", error);
        setError("Failed to connect to contract. Please check your network connection.");
      });
    }
  }, [contract, publicClient]);

  // Expose debug function in development environment
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error - Debug function for development
      window.debugFetchMatch = async (matchId) => {
        try {
          if (!contract) {
            console.error('Contract not available');
            return null;
          }
          return await fetchMatch(contract, publicClient, matchId.toString());
        } catch (error) {
          console.error('Error in debugFetchMatch:', error);
          return null;
        }
      };
    }
  }, [contract, publicClient]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Matches</h1>
          <Link
            href="/matches/create"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Create Match
          </Link>
        </div>

        {/* Wallet Link Banner */}
        {showWalletBanner && (
          <WalletLinkBanner onDismiss={() => setShowWalletBanner(false)} />
        )}

        {/* Discord Link Banner */}
        {needsDiscordLink && showDiscordBanner && (
          <DiscordLinkBanner onDismiss={() => setShowDiscordBanner(false)} />
        )}

        {/* Fixed height container to prevent layout shifts */}
        <div className="min-h-[800px]">
          {error ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-destructive font-medium">Connection Error</p>
              <p className="text-muted-foreground">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                Refresh Page
              </button>
            </div>
          ) : (
            <MatchList contract={contract} publicClient={publicClient} />
          )}
        </div>
      </div>
    </div>
  );
}
