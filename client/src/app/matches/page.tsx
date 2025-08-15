"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import MatchList from "@/components/match/match-list";
import PlayerStats from "@/components/match/player-stats";
import ContractStats from "@/components/match/contract-stats";
import LatestMatches from "@/components/match/latest-matches";
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

    // If user has linked Discord ID, definitely don't show banner
    if (hasLinkedDiscordId === true) return false;

    // Show banner if user is connected but doesn't have linked Discord ID
    return isConnected && hasLinkedDiscordId === false;
  }, [isCheckingDiscord, hasLinkedDiscordId, isConnected]);

  // Debug logging
  React.useEffect(() => {
    console.log("Discord Link Debug:", {
      isConnected,
      hasLinkedDiscordId,
      isCheckingDiscord,
      needsDiscordLink,
      showDiscordBanner
    });
  }, [isConnected, hasLinkedDiscordId, isCheckingDiscord, needsDiscordLink, showDiscordBanner]);

  // Auto-hide Discord banner if user has linked Discord
  React.useEffect(() => {
    if (hasLinkedDiscordId === true) {
      setShowDiscordBanner(false);
    }
  }, [hasLinkedDiscordId]);

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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Banners Section */}
      <section className="py-4 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="container mx-auto px-4 space-y-4">
          {/* Wallet Link Banner */}
          {showWalletBanner && (
            <WalletLinkBanner onDismiss={() => setShowWalletBanner(false)} />
          )}

          {/* Discord Link Banner - Only show if user needs to link Discord */}
          {needsDiscordLink && showDiscordBanner && (
            <DiscordLinkBanner onDismiss={() => setShowDiscordBanner(false)} />
          )}
        </div>
      </section>

      {/* Matches Section */}
      <section className="py-16 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="container mx-auto px-4">
          {error ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-red-400 font-medium">Connection Error</p>
              <p className="text-gray-300">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-300 hover:scale-105"
              >
                Refresh Page
              </button>
            </div>
          ) : (
            <MatchList contract={contract} publicClient={publicClient} />
          )}
        </div>
      </section>

      {/* Platform Statistics Section */}
      <section className="py-16 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Platform Statistics</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Track the growth and activity of the platform
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <PlayerStats />
            <ContractStats />
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-400 text-sm">
              * Statistics update every 10 minutes
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </section>

      {/* Latest Matches Section */}
      <section className="py-16 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Latest Matches</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Recent match activity and results
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <LatestMatches />
          </div>
        </div>
      </section>
    </div>
  );
}
