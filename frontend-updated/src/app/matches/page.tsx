"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import { fetchMatches } from "@/lib/match";

// Fetch matches with a 30-second polling interval
const POLLING_INTERVAL = 30000;
let lastFetchTime = 0;

export default function MatchesPage() {
  const { toast } = useToast();
  const contract = useContract();
  const publicClient = usePublicClient();

  // Fetch matches using SWR for caching and revalidation
  const fetchMatchesCallback = React.useCallback(async () => {
    if (!contract || !publicClient) return [];

    // Rate limiting protection
    const now = Date.now();
    if (now - lastFetchTime < 1000) {
      // Minimum 1 second between requests
      throw new Error("Rate limit: Please wait before fetching again");
    }
    lastFetchTime = now;

    try {
      return await fetchMatches(contract, publicClient);
    } catch (error) {
      console.error("Error fetching matches:", error);
      if (error instanceof Error && error.message.includes("429")) {
        toast({
          variant: "destructive",
          title: "Rate Limited",
          description:
            "Too many requests. Please wait a moment before refreshing.",
        });
      }
      throw error;
    }
  }, [contract, publicClient, toast]);

  const {
    data: matches = [],
    error,
    isLoading,
  } = useSWR("matches", fetchMatchesCallback, {
    refreshInterval: POLLING_INTERVAL,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  // Show error toast when fetch fails
  React.useEffect(() => {
    if (error) {
      console.error("Error in SWR:", error);
      if (!error.message?.includes("Rate limit")) {
        // Don't show for intentional rate limiting
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch matches. Please try again later.",
        });
      }
    }
  }, [error, toast]);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderContent = () => {
    if (error && !error.message?.includes("Rate limit")) {
      return (
        <div className="text-center py-4 text-red-500">
          Failed to load matches. Please try again later.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!matches || matches.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No matches found</p>
          <p className="mt-2">Be the first to create a match!</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map((match) => (
          <Link
            key={match.id.toString()}
            href={`/matches/${match.id.toString()}`}
            className="block p-6 border rounded-lg hover:border-primary transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {match.matchType} Match #{match.id.toString()}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Prize Pool: {formatEther(match.totalAmount)} ETH
                </p>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  !match.isOpen
                    ? "bg-gray-100 text-gray-800"
                    : match.player2 ===
                      "0x0000000000000000000000000000000000000000"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {!match.isOpen
                  ? "Completed"
                  : match.player2 ===
                    "0x0000000000000000000000000000000000000000"
                  ? "Open"
                  : "In Progress"}
              </span>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Team A:</p>
                {match.teamA.map((address) => (
                  <p key={address} className="text-sm pl-2">
                    {truncateAddress(address)}
                  </p>
                ))}
              </div>
              {match.teamB.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Team B:</p>
                  {match.teamB.map((address) => (
                    <p key={address} className="text-sm pl-2">
                      {truncateAddress(address)}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-sm">
                <span className="font-medium">Stake per player:</span>{" "}
                {formatEther(match.player1Amount)} ETH
              </p>
              {match.donatedAmount > BigInt(0) && (
                <p className="text-sm">
                  <span className="font-medium">Donations:</span>{" "}
                  {formatEther(match.donatedAmount)} ETH
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
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

      {renderContent()}
    </div>
  );
}
