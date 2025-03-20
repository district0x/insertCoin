import { useEffect } from "react";
import useSWR from "swr";
import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "@/lib/contracts/abis/OneVOne";
import { OnChainMatch } from "@/types/match";
import { fetchMatch } from "@/lib/match/fetch";

interface UseMatchDataProps {
  matchId: string | null;
  contract: GetContractReturnType<typeof ONEVONE_ABI> | null;
  publicClient: PublicClient | undefined;
  isVisible: boolean;
}

export function useMatchData({ 
  matchId, 
  contract, 
  publicClient, 
  isVisible 
}: UseMatchDataProps) {
  // Fetch match data with optimistic updates
  const { data, error, mutate } = useSWR(
    matchId && contract && publicClient && isVisible
      ? `match-${matchId}`
      : null,
    async () => {
      console.log("[useMatchData] SWR fetcher starting...");
      if (!contract || !publicClient || !matchId) {
        console.log("[useMatchData] Missing dependencies in fetcher");
        return null;
      }

      try {
        const data = await fetchMatch(contract, publicClient, matchId);
        console.log("[useMatchData] Fetched match data:", data);
        if (!data) {
          console.log("[useMatchData] No match data returned");
          return null;
        }
        return data;
      } catch (err) {
        console.error("[useMatchData] Error in SWR fetcher:", err);
        throw err;
      }
    },
    {
      refreshInterval: isVisible ? 30000 : 0,
      revalidateOnFocus: false,
      keepPreviousData: true, // Keep showing old data while loading new data
    }
  );

  // Log state changes
  useEffect(() => {
    if (data) {
      console.log("[useMatchData] Match data updated:", data);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      console.error("[useMatchData] Error state:", error);
    }
  }, [error]);

  return {
    match: data as OnChainMatch | null,
    isLoading: !error && !data,
    error,
    mutate
  };
} 