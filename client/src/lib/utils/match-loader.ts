import { OnChainMatch } from "@/types/match";
import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "@/lib/contracts/abis/OneVOne";
import { fetchMatch } from "@/lib/match/fetch";

// Constants
export const MATCHES_PER_PAGE = 12;
export const POLLING_INTERVAL = 60000; // 60 seconds
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000; // 1 second

// Helper function to retry failed requests
export const retryWithBackoff = async <T,>(
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

// Function to safely read the nextMatchId with retries
export const readNextMatchId = async (
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient
): Promise<bigint> => {
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
    
    if (process.env.NODE_ENV === 'development') {
      return BigInt(50); // Mock value for development
    }
    
    throw error;
  }
};

// Function to fetch a single match
export const fetchSingleMatch = async (
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  matchId: number,
  loadedMatchIds: Set<string>
): Promise<OnChainMatch | null> => {
  if (!contract || !publicClient) return null;
  
  try {
    // Check if this match is already loaded
    if (loadedMatchIds.has(matchId.toString())) {
      return null;
    }
    
    // Use the fetchMatch function to get a single match with retries
    const match = await retryWithBackoff(async () => {
      return await fetchMatch(contract, publicClient, matchId.toString());
    });
    
    return match;
  } catch (error) {
    console.error(`Error fetching match ${matchId}:`, error);
    throw error;
  }
};

// Create a counter for generating unique IDs
let uniqueIdCounter = 0;
export const getUniqueId = () => `id-${uniqueIdCounter++}`;

// Reset counter
export const resetUniqueIdCounter = () => {
  uniqueIdCounter = 0;
}; 