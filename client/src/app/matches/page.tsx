"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInView } from "react-intersection-observer";
import { OnChainMatch } from "@/types/match";
import { fetchMatches, prefetchMatch } from "@/lib/match";

const MATCHES_PER_PAGE = 12;
const POLLING_INTERVAL = 30000; // 30 seconds

export default function MatchesPage() {
  const { toast } = useToast();
  const contract = useContract();
  const publicClient = usePublicClient();
  const [matches, setMatches] = React.useState<OnChainMatch[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [page, setPage] = React.useState(1);
  
  // Intersection Observer setup
  const { ref, inView } = useInView({
    threshold: 0.5,
  });

  // Initial fetch
  const fetchInitialMatches = React.useCallback(async () => {
    if (!contract || !publicClient) return;
    
    try {
      setIsLoading(true);
      const initialMatches = await fetchMatches(contract, publicClient, {
        limit: MATCHES_PER_PAGE,
        offset: 0,
      });
      setMatches(initialMatches);
      setHasMore(initialMatches.length === MATCHES_PER_PAGE);
    } catch (error) {
      console.error("Error fetching initial matches:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch matches. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [contract, publicClient, toast]);

  // Load more matches when scrolling
  const loadMoreMatches = React.useCallback(async () => {
    if (!contract || !publicClient || isLoading || !hasMore) return;

    try {
      setIsLoading(true);
      const nextMatches = await fetchMatches(contract, publicClient, {
        limit: MATCHES_PER_PAGE,
        offset: page * MATCHES_PER_PAGE,
      });

      if (nextMatches.length > 0) {
        setMatches(prev => {
          const existingIds = new Set(prev.map(m => m.id.toString()));
          const uniqueNewMatches = nextMatches.filter(
            match => !existingIds.has(match.id.toString())
          );
          return [...prev, ...uniqueNewMatches];
        });
        setPage(p => p + 1);
      }
      
      setHasMore(nextMatches.length === MATCHES_PER_PAGE);
    } catch (error) {
      console.error("Error fetching more matches:", error);
    } finally {
      setIsLoading(false);
    }
  }, [contract, publicClient, page, isLoading, hasMore]);

  // Initial load
  React.useEffect(() => {
    fetchInitialMatches();
  }, [fetchInitialMatches]);

  // Poll for updates
  React.useEffect(() => {
    const interval = setInterval(fetchInitialMatches, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchInitialMatches]);

  // Load more when scrolling to bottom
  React.useEffect(() => {
    if (inView) {
      loadMoreMatches();
    }
  }, [inView, loadMoreMatches]);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleMatchHover = React.useCallback((matchId: string) => {
    if (contract && publicClient) {
      prefetchMatch(contract, publicClient, matchId);
    }
  }, [contract, publicClient]);

  if (isLoading && matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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

        {matches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No matches found</p>
            <p className="mt-2">Be the first to create a match!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => (
                <Link
                  key={match.id.toString()}
                  href={`/matches/${match.id.toString()}`}
                  className="block p-6 border rounded-lg hover:border-primary transition-colors"
                  onMouseEnter={() => handleMatchHover(match.id.toString())}
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
            
            {/* Loading indicator */}
            <div ref={ref} className="py-4 text-center">
              {isLoading && (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              )}
              {!hasMore && matches.length > 0 && (
                <p className="text-muted-foreground">No more matches to load</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
