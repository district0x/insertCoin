import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../../contracts/abis/ABI";
import { OnChainMatch } from "@/types/match";
import { getCachedMatch } from "./cache";
import { fetchMatchDirect } from "./fetchMatch";

export async function batchFetchMatches(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  matchIds: string[]
): Promise<OnChainMatch[]> {
  if (!contract || !publicClient || !matchIds.length) {
    return [];
  }

  // Initialize cached matches array
  const cachedMatches: OnChainMatch[] = [];
  
  try {
    // First check cache for all matches
    const uncachedIds: string[] = [];

    // Check which matches are already cached
    for (const id of matchIds) {
      const cached = getCachedMatch(id);
      if (cached) {
        cachedMatches.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // If all matches are cached, return them
    if (uncachedIds.length === 0) {
      return cachedMatches;
    }

    // Fetch uncached matches in batches to avoid rate limiting
    const fetchedMatches: (OnChainMatch | null)[] = [];
    const BATCH_SIZE = 3;
    for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
      const batchIds = uncachedIds.slice(i, i + BATCH_SIZE);
      
      // Process each ID in the batch with individual error handling
      const batchPromises = batchIds.map(async (id) => {
        try {
          // Use direct contract calls instead of throttleRequest to simplify
          const match = await fetchMatchDirect(contract, publicClient, id.toString());
          return match;
        } catch (error) {
          console.error(`Failed to fetch match ${id}:`, error);
          return null;
        }
      });
      
      // Wait for the current batch to complete
      const batchResults = await Promise.all(batchPromises);
      fetchedMatches.push(...batchResults);
      
      // Add a small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < uncachedIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const validMatches = fetchedMatches.filter(Boolean) as OnChainMatch[];
    return [...cachedMatches, ...validMatches];
  } catch (error) {
    console.error('Error in batch fetch:', error);
    // Return cached matches if available
    return cachedMatches;
  }
} 