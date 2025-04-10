import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../../contracts/abis/ABI";
import { OnChainMatch } from "@/types/match";
import { prefetchCache } from "./cache";
import { fetchMatch } from "./fetchMatch";

export function prefetchMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  matchId: string
): Promise<OnChainMatch | null> {
  // Check if already prefetching
  const existing = prefetchCache.get(matchId);
  if (existing) return existing;

  // Start new prefetch
  const promise = fetchMatch(contract, publicClient, matchId);
  prefetchCache.set(matchId, promise);
  
  // Clean up after prefetch completes
  promise.finally(() => {
    setTimeout(() => {
      prefetchCache.delete(matchId);
    }, 30000); // Clear after 30 seconds
  });

  return promise;
}

// Batch prefetch multiple matches
export async function prefetchMatches(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  matchIds: string[]
): Promise<void> {
  const promises = matchIds.map(id => 
    prefetchMatch(contract, publicClient, id)
  );
  await Promise.all(promises);
} 