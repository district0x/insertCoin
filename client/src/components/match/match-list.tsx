import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { OnChainMatch } from "@/types/match";
import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "@/lib/contracts/abis/OneVOne";
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
import { usePolling } from "@/hooks/usePolling";

interface MatchListProps {
  contract: GetContractReturnType<typeof ONEVONE_ABI> | null;
  publicClient: PublicClient | undefined;
}

interface LoadingMatchItem {
  id: number;
  uniqueKey: string;
}

const MatchList = ({ contract, publicClient }: MatchListProps) => {
  const { toast } = useToast();
  const [matches, setMatches] = useState<OnChainMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMatchIds, setLoadingMatchIds] = useState<LoadingMatchItem[]>([]);
  const [loadedMatchIds, setLoadedMatchIds] = useState<Set<string>>(new Set());
  const [stableSkeletonCount, setStableSkeletonCount] = useState(6);

  // Intersection Observer setup
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px',
  });

  // Reset counter on component mount
  useEffect(() => {
    resetUniqueIdCounter();
  }, []);

  // Function to fetch a single match and add it to the state
  const handleFetchSingleMatch = useCallback(async (matchId: number) => {
    if (!contract || !publicClient) return;
    
    try {
      // Check if this match is already loaded
      if (loadedMatchIds.has(matchId.toString())) {
        return;
      }
      
      // Add to loading state with a unique ID from our counter
      const uniqueKey = `${matchId}-${getUniqueId()}`;
      setLoadingMatchIds(prev => [...prev, { id: matchId, uniqueKey }]);
      
      // Fetch the match
      const match = await fetchSingleMatch(contract, publicClient, matchId, loadedMatchIds);
      
      if (match) {
        // Add to matches state, ensuring no duplicates
        setMatches(prev => {
          const existingIds = new Set(prev.map(m => m.id.toString()));
          if (!existingIds.has(match.id.toString())) {
            return [...prev, match];
          }
          return prev;
        });
        
        // Mark as loaded
        setLoadedMatchIds(prev => {
          const newSet = new Set(prev);
          newSet.add(matchId.toString());
          return newSet;
        });
      }
    } catch (error) {
      console.error(`Error fetching match ${matchId}:`, error);
      // Don't show toast for every failed match to avoid spamming
      if (Math.random() < 0.2) { // Only show error for ~20% of failures
        toast({
          variant: "destructive",
          title: "Error loading match",
          description: `Failed to load match #${matchId}. Some matches may not display correctly.`,
        });
      }
    } finally {
      // Use a longer delay to prevent flickering and batch removals
      setTimeout(() => {
        // Filter by match ID prefix to remove all loading states for this match
        setLoadingMatchIds(prev => prev.filter(item => !item.uniqueKey.startsWith(`${matchId}-`)));
      }, 500);
    }
  }, [contract, publicClient, loadedMatchIds, toast]);

  // Initial fetch with progressive loading
  const fetchInitialMatches = useCallback(async () => {
    if (!contract || !publicClient) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      
      // First, get the total number of matches with retry mechanism
      const nextMatchId = await readNextMatchId(contract, publicClient);
      
      const totalMatches = Number(nextMatchId) - 1;
      if (totalMatches <= 0) {
        setMatches([]);
        setHasMore(false);
        setInitialLoad(false);
        setIsLoading(false);
        return;
      }
      
      // Create array of match IDs in reverse order (latest first)
      const matchIds = Array.from(
        { length: Math.min(totalMatches, MATCHES_PER_PAGE) },
        (_, i) => totalMatches - i
      );
      
      // Start fetching each match individually with a small delay between each to avoid rate limits
      matchIds.forEach((id, index) => {
        setTimeout(() => {
          handleFetchSingleMatch(id);
        }, index * 300); // 300ms delay between requests
      });
      
      // Set hasMore based on total matches
      setHasMore(totalMatches > MATCHES_PER_PAGE);
      
      // Delay turning off initial load to prevent flickering
      setTimeout(() => {
        setInitialLoad(false);
      }, 500);
    } catch (error) {
      console.error("Error fetching initial matches:", error);
      // Show more detailed error in toast and set error state
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error fetching matches",
        description: errorMessage,
      });
    } finally {
      // Delay turning off loading state to prevent flickering
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }
  }, [contract, publicClient, toast, handleFetchSingleMatch]);

  // Set up polling for updates using our custom hook
  usePolling({
    callback: fetchInitialMatches,
    interval: POLLING_INTERVAL,
    enabled: !initialLoad && !!contract && !!publicClient
  });

  // Load more matches when scrolling
  const loadMoreMatches = useCallback(async () => {
    if (!contract || !publicClient || isLoadingMore || !hasMore) return;

    try {
      setIsLoadingMore(true);
      
      // Get the total number of matches with retry mechanism
      const nextMatchId = await readNextMatchId(contract, publicClient);
      
      const totalMatches = Number(nextMatchId) - 1;
      if (totalMatches <= 0) {
        setHasMore(false);
        return;
      }
      
      // Calculate the next batch of match IDs
      const startIndex = page * MATCHES_PER_PAGE;
      const endIndex = Math.min(startIndex + MATCHES_PER_PAGE, totalMatches);
      
      if (startIndex >= totalMatches) {
        setHasMore(false);
        return;
      }
      
      const matchIds = Array.from(
        { length: endIndex - startIndex },
        (_, i) => totalMatches - startIndex - i
      );
      
      // Set a stable number of skeletons for loading more
      setStableSkeletonCount(matchIds.length);
      
      // Start fetching each match individually with a small delay between each to avoid rate limits
      matchIds.forEach((id, index) => {
        setTimeout(() => {
          handleFetchSingleMatch(id);
        }, index * 300);
      });
      
      // Update page
      setPage(p => p + 1);
      
      // Update hasMore
      setHasMore(endIndex < totalMatches);
    } catch (error) {
      console.error("Error fetching more matches:", error);
      toast({
        variant: "destructive",
        title: "Error loading more matches",
        description: "Failed to load additional matches. Please try again later.",
      });
    } finally {
      // Delay turning off loading state to prevent flickering
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 500);
    }
  }, [contract, publicClient, page, isLoadingMore, hasMore, handleFetchSingleMatch, toast]);

  // Load more when scrolling to bottom
  useEffect(() => {
    if (inView && !isLoadingMore && hasMore && !initialLoad) {
      loadMoreMatches();
    }
  }, [inView, loadMoreMatches, isLoadingMore, hasMore, initialLoad]);

  // Initial load
  useEffect(() => {
    if (contract && publicClient) {
      fetchInitialMatches();
    }
  }, [fetchInitialMatches, contract, publicClient]);

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

  if (isLoading && sortedMatches.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-300">
        {Array.from({ length: 6 }).map(() => {
          const key = getUniqueId();
          return (
            <MatchSkeleton key={`initial-skeleton-${key}`} />
          );
        })}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-destructive font-medium">Error loading matches</p>
        <p className="text-muted-foreground">{error}</p>
        <button 
          onClick={() => fetchInitialMatches()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (sortedMatches.length === 0 && !isLoading && loadingMatchIds.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No matches found</p>
        <p className="mt-2">Be the first to create a match!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-300">
        {/* Loaded matches */}
        {sortedMatches.map((match) => (
          <div key={match.id.toString()} className="transition-opacity duration-300 ease-in-out">
            <MatchCard 
              match={match} 
              onHover={() => handleMatchHover(match.id.toString())}
            />
          </div>
        ))}
        
        {/* Skeleton loaders for matches currently being loaded */}
        {loadingMatchIds.map((item) => (
          <div key={item.uniqueKey} className="transition-opacity duration-300 ease-in-out">
            <MatchSkeleton id={item.id} />
          </div>
        ))}
        
        {/* Stable skeleton loaders for loading more */}
        {isLoadingMore && hasMore && (
          <>
            {Array.from({ length: stableSkeletonCount }).map(() => {
              const key = getUniqueId();
              return (
                <div key={`loading-more-${key}`} className="transition-opacity duration-300 ease-in-out">
                  <MatchSkeleton />
                </div>
              );
            })}
          </>
        )}
      </div>
      
      {/* Loading indicator */}
      <div ref={ref} className="py-4 text-center transition-opacity duration-300">
        {loadingMatchIds.length > 0 && (
          <p className="text-muted-foreground">
            Loading {loadingMatchIds.length} match{loadingMatchIds.length !== 1 ? 'es' : ''}...
          </p>
        )}
        {!isLoadingMore && hasMore && loadingMatchIds.length === 0 && (
          <p className="text-muted-foreground">Scroll for more matches</p>
        )}
        {!hasMore && sortedMatches.length > 0 && loadingMatchIds.length === 0 && (
          <p className="text-muted-foreground">No more matches to load</p>
        )}
      </div>
    </>
  );
};

export default MatchList; 