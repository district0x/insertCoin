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
import { OnChainMatch } from "@/types/match";

const INITIAL_MATCHES_COUNT = 7;
const POLLING_INTERVAL = 30000;
let lastFetchTime = 0;

export default function Home() {
  const { toast } = useToast();
  const contract = useContract();
  const publicClient = usePublicClient();
  const [allMatches, setAllMatches] = React.useState<OnChainMatch[]>([]);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasLoadedAll, setHasLoadedAll] = React.useState(false);

  // Fetch initial matches using SWR for caching and revalidation
  const fetchInitialMatches = React.useCallback(async () => {
    if (!contract || !publicClient) return [];

    // Rate limiting protection
    const now = Date.now();
    if (now - lastFetchTime < 1000) {
      throw new Error("Rate limit: Please wait before fetching again");
    }
    lastFetchTime = now;

    try {
      const matches = await fetchMatches(contract, publicClient, {
        limit: INITIAL_MATCHES_COUNT,
      });
      setAllMatches(matches);
      return matches;
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
    data: initialMatches = [],
    error,
    isLoading,
  } = useSWR("initial-matches", fetchInitialMatches, {
    refreshInterval: POLLING_INTERVAL,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  // Load remaining matches in the background
  React.useEffect(() => {
    const loadRemainingMatches = async () => {
      if (!contract || !publicClient || isLoadingMore || hasLoadedAll) return;

      try {
        setIsLoadingMore(true);
        const remainingMatches = await fetchMatches(contract, publicClient, {
          offset: INITIAL_MATCHES_COUNT,
        });

        // Only update if we got new matches
        if (remainingMatches.length > 0) {
          setAllMatches((prev) => {
            // Create a Set of existing match IDs for quick lookup
            const existingIds = new Set(prev.map((m) => m.id.toString()));

            // Filter out any matches that we already have
            const newMatches = remainingMatches.filter(
              (match) => !existingIds.has(match.id.toString())
            );

            return [...prev, ...newMatches];
          });
        } else {
          setHasLoadedAll(true);
        }
      } catch (error) {
        console.error("Error loading remaining matches:", error);
      } finally {
        setIsLoadingMore(false);
      }
    };

    if (initialMatches.length > 0 && !hasLoadedAll) {
      loadRemainingMatches();
    }
  }, [contract, publicClient, initialMatches, isLoadingMore, hasLoadedAll]);

  // Show error toast when fetch fails
  React.useEffect(() => {
    if (error) {
      console.error("Error in SWR:", error);
      if (!error.message?.includes("Rate limit")) {
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

    const matches = allMatches.length > 0 ? allMatches : initialMatches;

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
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold sm:text-6xl">Web3 Gaming Platform</h1>
        <p className="text-xl text-muted-foreground max-w-[600px] mx-auto">
          Play 1v1, 2v2, and 5v5 matches. Compete and win prizes.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">Active Matches</h2>
          <Link
            href="/matches/create"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Create Match
          </Link>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}
