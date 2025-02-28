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
import { fetchMatch } from "@/lib/match/fetch";

const MATCHES_PER_PAGE = 12;
const POLLING_INTERVAL = 60000; // Increased to 60 seconds from 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Create a counter for generating unique IDs
let uniqueIdCounter = 0;
const getUniqueId = () => `id-${uniqueIdCounter++}`;

// Helper function to retry failed requests
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY,
  backoff = 2
): Promise<T> => {
  try {
    return await fn();
    } catch (error) {
    // Check if we should retry
    if (retries <= 0) throw error;
    
    // Check if it's a rate limit error
    const isRateLimit = error instanceof Error && 
      (error.message.includes('exceeded its compute units') || 
       error.message.includes('rate limit') ||
       error.message.includes('too many requests'));
    
    if (!isRateLimit) throw error;
    
    console.log(`Rate limit hit, retrying in ${delay}ms... (${retries} retries left)`);
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Retry with increased delay
    return retryWithBackoff(fn, retries - 1, delay * backoff, backoff);
  }
};

// Skeleton loader component for matches with ID display
const MatchSkeleton = ({ id }: { id?: number }) => (
  <div className="p-6 border rounded-lg animate-pulse transition-opacity duration-300">
    <div className="flex justify-between items-start mb-4">
      <div>
        <div className="h-5 w-32 bg-gray-200 rounded mb-2 flex items-center">
          {id && (
            <span className="text-xs text-gray-500 ml-2">Loading match #{id}...</span>
          )}
        </div>
        <div className="h-4 w-24 bg-gray-200 rounded"></div>
      </div>
      <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
    </div>
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="h-4 w-16 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 w-24 bg-gray-200 rounded ml-2"></div>
      </div>
      <div className="space-y-1">
        <div className="h-4 w-16 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 w-24 bg-gray-200 rounded ml-2"></div>
      </div>
      <div className="h-4 w-40 bg-gray-200 rounded mt-2"></div>
    </div>
  </div>
);

// Match card component
const MatchCard = ({ match, onHover }: { match: OnChainMatch; onHover: () => void }) => {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
                <Link
                  href={`/matches/${match.id.toString()}`}
                  className="block p-6 border rounded-lg hover:border-primary transition-colors"
      onMouseEnter={onHover}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {match.matchType} Match #{match.id.toString()}
                      </h3>
                      <p className="text-sm text-muted-foreground">
            Prize Pool: {formatEther(match.totalAmount)} {match.isERC20 ? "MTK" : "ETH"}
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
          {formatEther(match.player1Amount)} {match.isERC20 ? "MTK" : "ETH"}
                    </p>
                    {match.donatedAmount > BigInt(0) && (
                      <p className="text-sm">
                        <span className="font-medium">Donations:</span>{" "}
            {formatEther(match.donatedAmount)} {match.isERC20 ? "MTK" : "ETH"}
                      </p>
                    )}
                  </div>
                </Link>
  );
};

export default function MatchesPage() {
  const { toast } = useToast();
  const contract = useContract();
  const publicClient = usePublicClient();
  const [matches, setMatches] = React.useState<OnChainMatch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [initialLoad, setInitialLoad] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMatchIds, setLoadingMatchIds] = React.useState<Array<{ id: number, uniqueKey: string }>>([]);
  const [loadedMatchIds, setLoadedMatchIds] = React.useState<Set<string>>(new Set());
  const [stableSkeletonCount, setStableSkeletonCount] = React.useState(6); // For stable initial loading
  
  // Reset counter on component mount
  React.useEffect(() => {
    uniqueIdCounter = 0;
  }, []);
  
  // Debug contract address
  React.useEffect(() => {
    // Try to directly call nextMatchId
    if (contract && publicClient) {
      publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "nextMatchId",
      }).catch(error => {
        console.error("nextMatchId direct call failed:", error);
        setError("Failed to connect to the blockchain. Please check your network connection and try again.");
      });
    }
  }, [contract, publicClient]);
  
  // Intersection Observer setup
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px',
  });

  // Function to safely read the nextMatchId with retries
  const readNextMatchId = React.useCallback(async () => {
    if (!contract || !publicClient) {
      throw new Error("Contract or publicClient not available");
    }
    
    try {
      return await retryWithBackoff(async () => {
        return await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "nextMatchId",
        });
      });
    } catch (error) {
      console.error("Failed to read nextMatchId after retries:", error);
      
      // If we're in development, return a mock value
      if (process.env.NODE_ENV === 'development') {
        return BigInt(50); // Mock value for development
      }
      
      throw error;
    }
  }, [contract, publicClient]);

  // Function to fetch a single match and add it to the state
  const fetchSingleMatch = React.useCallback(async (matchId: number) => {
    if (!contract || !publicClient) return;
    
    try {
      // Check if this match is already loaded
      if (loadedMatchIds.has(matchId.toString())) {
        return;
      }
      
      // Add to loading state with a unique ID from our counter
      const uniqueKey = `${matchId}-${getUniqueId()}`;
      setLoadingMatchIds(prev => [...prev, { id: matchId, uniqueKey }]);
      
      // Use the fetchMatch function to get a single match with retries
      const match = await retryWithBackoff(async () => {
        return await fetchMatch(contract, publicClient, matchId.toString());
      });
      
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
  const fetchInitialMatches = React.useCallback(async () => {
    if (!contract || !publicClient) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      
      // First, get the total number of matches with retry mechanism
      const nextMatchId = await readNextMatchId();
      
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
      // Use a longer delay between requests to reduce flickering
      matchIds.forEach((id, index) => {
        setTimeout(() => {
          fetchSingleMatch(id);
        }, index * 300); // Increased from 200ms to 300ms for smoother loading
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
  }, [contract, publicClient, toast, fetchSingleMatch, readNextMatchId]);

  // Load more matches when scrolling
  const loadMoreMatches = React.useCallback(async () => {
    if (!contract || !publicClient || isLoadingMore || !hasMore) return;

    try {
      setIsLoadingMore(true);
      
      // Get the total number of matches with retry mechanism
      const nextMatchId = await readNextMatchId();
      
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
          fetchSingleMatch(id);
        }, index * 300); // Increased from 200ms to 300ms for smoother loading
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
  }, [contract, publicClient, page, isLoadingMore, hasMore, fetchSingleMatch, readNextMatchId, toast]);

  // Initial load
  React.useEffect(() => {
    if (contract && publicClient) {
      fetchInitialMatches();
    }
  }, [fetchInitialMatches, contract, publicClient]);

  // Poll for updates - only when tab is visible
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Start polling when tab is visible
        interval = setInterval(fetchInitialMatches, POLLING_INTERVAL);
      } else {
        // Clear interval when tab is hidden
        clearInterval(interval);
      }
    };
    
    // Set up initial interval
    if (document.visibilityState === 'visible') {
      interval = setInterval(fetchInitialMatches, POLLING_INTERVAL);
    }
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchInitialMatches]);

  // Load more when scrolling to bottom
  React.useEffect(() => {
    if (inView && !isLoadingMore && hasMore && !initialLoad) {
      loadMoreMatches();
    }
  }, [inView, loadMoreMatches, isLoadingMore, hasMore, initialLoad]);

  const handleMatchHover = React.useCallback((matchId: string) => {
    if (contract && publicClient) {
      prefetchMatch(contract, publicClient, matchId);
    }
  }, [contract, publicClient]);

  // Sort matches by ID (newest first)
  const sortedMatches = React.useMemo(() => {
    return [...matches].sort((a, b) => {
      return Number(b.id - a.id);
    });
  }, [matches]);

  // Remove the global fetchMatchDirect function since we're using fetchMatch directly
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.debugFetchMatch = async (matchId) => {
        try {
          if (!contract || !publicClient) {
            console.error('Contract or publicClient not available');
            return null;
          }
          return await fetchMatch(contract, publicClient, matchId.toString());
        } catch (error) {
          console.error(`Error in debugFetchMatch for match ${matchId}:`, error);
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

        {/* Fixed height container to prevent layout shifts */}
        <div className="min-h-[800px]">
          {isLoading && sortedMatches.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-300">
              {Array.from({ length: 6 }).map((_, index) => (
                <MatchSkeleton key={`initial-skeleton-${getUniqueId()}`} />
              ))}
            </div>
          ) : error ? (
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
          ) : sortedMatches.length === 0 && !isLoading && loadingMatchIds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No matches found</p>
              <p className="mt-2">Be the first to create a match!</p>
            </div>
          ) :
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
                    {Array.from({ length: stableSkeletonCount }).map((_, index) => (
                      <div key={`loading-more-${index}`} className="transition-opacity duration-300 ease-in-out">
                        <MatchSkeleton />
                      </div>
                    ))}
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
          }
        </div>
      </div>
    </div>
  );
}
