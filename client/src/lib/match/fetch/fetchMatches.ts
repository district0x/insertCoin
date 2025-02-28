import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../../contracts/abis/OneVOne";
import { OnChainMatch } from "@/types/match";
import { batchFetchMatches } from "./batchFetch";

export async function fetchMatches(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<OnChainMatch[]> {
  if (!contract || !publicClient) {
    return [];
  }

  // Verify contract address is valid
  if (!contract.address || contract.address === '0x0000000000000000000000000000000000000000') {
    return [];
  }

  try {
    let nextMatchId;
    
    try {
      nextMatchId = await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "nextMatchId",
      });
    } catch (error) {
      console.error('Failed to read nextMatchId:', error);
      // If we can't read nextMatchId, try to return some hardcoded test data
      
      // Create some mock matches for testing
      const mockMatches: OnChainMatch[] = [];
      
      // Only create mock data if we're in development
      if (process.env.NODE_ENV === 'development') {
        // Create 5 mock matches
        for (let i = 1; i <= 5; i++) {
          const mockMatch: OnChainMatch = {
            id: BigInt(i),
            player1: `0x${'1'.padStart(40, '0')}` as `0x${string}`,
            player2: i % 2 === 0 ? `0x${'2'.padStart(40, '0')}` as `0x${string}` : `0x${'0'.padStart(40, '0')}` as `0x${string}`,
            player1Amount: BigInt(1000000000000000000), // 1 ETH
            player2Amount: BigInt(1000000000000000000), // 1 ETH
            totalAmount: BigInt(2000000000000000000), // 2 ETH
            donatedAmount: BigInt(0),
            isOpen: i % 2 === 0 ? false : true,
            isERC20: i % 3 === 0,
            token: i % 3 === 0 ? process.env.NEXT_PUBLIC_MTK_TOKEN_ADDRESS as `0x${string}` : `0x${'0'.padStart(40, '0')}` as `0x${string}`,
            matchType: i % 4 === 0 ? "FIVE_V_FIVE" : i % 2 === 0 ? "TWO_V_TWO" : "ONE_V_ONE",
            teamA: [`0x${'1'.padStart(40, '0')}` as `0x${string}`],
            teamB: i % 2 === 0 ? [`0x${'2'.padStart(40, '0')}` as `0x${string}`] : [],
            allPlayers: {
              teamA: {
                captain: `0x${'1'.padStart(40, '0')}` as `0x${string}`,
                player2: null,
                player3: null,
                player4: null,
                player5: null,
              },
              teamB: {
                captain: i % 2 === 0 ? `0x${'2'.padStart(40, '0')}` as `0x${string}` : `0x${'0'.padStart(40, '0')}` as `0x${string}`,
                player2: null,
                player3: null,
                player4: null,
                player5: null,
              },
            },
          };
          
          mockMatches.push(mockMatch);
        }
      }
      
      // Apply pagination if options are provided
      const start = options?.offset || 0;
      const end = options?.limit ? start + options?.limit : mockMatches.length;
      return mockMatches.slice(start, end);
    }

    // Create array of match IDs in reverse order (latest first)
    const totalMatches = Number(nextMatchId) - 1;
    if (totalMatches <= 0) {
      return [];
    }

    const matchIds = Array.from(
      { length: totalMatches },
      (_, i) => totalMatches - i
    );

    // Apply pagination if options are provided
    const start = options?.offset || 0;
    const end = options?.limit ? start + options?.limit : matchIds.length;
    const paginatedIds = matchIds.slice(start, end);

    // Use batch fetching instead of individual fetches
    return await batchFetchMatches(
      contract,
      publicClient,
      paginatedIds.map(id => id.toString())
    );
  } catch (error) {
    console.error('Failed to fetch matches:', error);
    return [];
  }
} 