import React, { useCallback, useEffect, useMemo, useState } from "react";
import { OnChainMatch } from "@/types/match";
import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";
import { useToast } from "@/hooks/use-toast";
import { prefetchMatch } from "@/lib/match";
import MatchCard from "./match-card";
import MatchSkeleton from "./match-skeleton";
import {
  fetchSingleMatch,
  getUniqueId,
  MATCHES_PER_PAGE,
  POLLING_INTERVAL,
  readNextMatchId,
  resetUniqueIdCounter
} from "@/lib/utils/match-loader";
import { fetchMatchMetadata, mergeMatchMetadata } from "@/lib/utils/match-metadata";
import { usePolling } from "@/hooks/usePolling";
import { Gamepad2, RefreshCw } from "lucide-react";

interface MatchListProps {
  contract: GetContractReturnType<typeof ONEVONE_ABI> | null;
  publicClient: PublicClient | undefined;
}

const MatchList = ({ contract, publicClient }: MatchListProps) => {
  const { toast } = useToast();
  const [matches, setMatches] = useState<OnChainMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset counter on component mount
  useEffect(() => {
    resetUniqueIdCounter();
  }, []);

  // Function to fetch latest matches
  const fetchLatestMatches = useCallback(async () => {
    if (!contract || !publicClient) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get the total number of matches
      const nextMatchId = await readNextMatchId(contract, publicClient);
      const totalMatches = Number(nextMatchId) - 1;

      if (totalMatches <= 0) {
        setMatches([]);
        setIsLoading(false);
        return;
      }

      // Get the latest 3 match IDs
      const matchIds = Array.from(
        { length: Math.min(totalMatches, MATCHES_PER_PAGE) },
        (_, i) => totalMatches - i
      );

      // Fetch all matches in parallel
      const matchPromises = matchIds.map(async (id) => {
        try {
          return await fetchSingleMatch(contract, publicClient, id, new Set());
        } catch (error) {
          console.error(`Error fetching match ${id}:`, error);
          return null;
        }
      });

      const fetchedMatches = await Promise.all(matchPromises);
      const validMatches = fetchedMatches.filter(match => match !== null) as OnChainMatch[];

      // Fetch metadata for all valid matches
      const matchIdsForMetadata = validMatches.map(match => Number(match.id));
      const metadata = await fetchMatchMetadata(matchIdsForMetadata);

      // Merge metadata with match data
      const matchesWithMetadata = mergeMatchMetadata(validMatches, metadata);

      setMatches(matchesWithMetadata);
    } catch (error) {
      console.error("Error fetching matches:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error fetching matches",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [contract, publicClient, toast]);

  // Set up polling for updates
  usePolling({
    callback: fetchLatestMatches,
    interval: POLLING_INTERVAL,
    enabled: !!contract && !!publicClient
  });

  // Initial load
  useEffect(() => {
    if (contract && publicClient) {
      fetchLatestMatches();
    }
  }, [fetchLatestMatches, contract, publicClient]);

  const handleMatchHover = useCallback((matchId: string) => {
    if (contract && publicClient) {
      prefetchMatch(contract, publicClient, matchId);
    }
  }, [contract, publicClient]);

  // Sort matches by ID (newest first)
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      return Number(b.id - a.id);
    });
  }, [matches]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map(() => {
          const key = getUniqueId();
          return <MatchSkeleton key={`skeleton-${key}`} />;
        })}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-8 max-w-md mx-auto">
          <p className="text-red-400 font-medium mb-2">Error loading matches</p>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => fetchLatestMatches()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-300 hover:scale-105 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (sortedMatches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <Gamepad2 className="h-8 w-8 text-red-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Recent Matches</h3>
            <p className="text-gray-300 mb-4">
              No matches have been created recently.
            </p>
            <p className="text-sm text-gray-400">
              Be the first to create a match and start competing!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedMatches.map((match) => (
          <div key={match.id.toString()} className="transition-all duration-300 ease-in-out hover:scale-105">
            <MatchCard
              match={match}
              onHover={() => handleMatchHover(match.id.toString())}
            />
          </div>
        ))}
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-lg">
          <RefreshCw className="h-4 w-4 text-red-400 animate-spin" />
          <p className="text-xs text-gray-300">
            Auto-refreshing every 10 minutes • Showing latest 3 matches
          </p>
        </div>
      </div>
    </div>
  );
};

export default MatchList; 