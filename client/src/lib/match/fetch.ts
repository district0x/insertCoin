import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../contracts/abis/OneVOne";
import { OnChainMatch } from "@/types/match";
import {
  Match2v2Response,
  Match5v5Response,
  MatchPlayers,
  determineMatchType,
} from "./types";
import { throttleRequest } from "../utils/rateLimit";

// Simple in-memory cache
const matchCache = new Map<string, { data: OnChainMatch; timestamp: number }>();

// Cache durations based on match state
const CACHE_DURATIONS = {
  COMPLETED: 5 * 60 * 1000, // 5 minutes for completed matches
  IN_PROGRESS: 30 * 1000,   // 30 seconds for in-progress matches
  OPEN: 60 * 1000,          // 1 minute for open matches
  DEFAULT: 30 * 1000        // 30 seconds default
};

function getCacheExpiry(match: OnChainMatch): number {
  if (!match.isOpen) return CACHE_DURATIONS.COMPLETED;
  if (match.player2 !== "0x0000000000000000000000000000000000000000") return CACHE_DURATIONS.IN_PROGRESS;
  return CACHE_DURATIONS.OPEN;
}

function getCachedMatch(matchId: string): OnChainMatch | null {
  const cached = matchCache.get(matchId);
  if (cached) {
    const cacheExpiry = getCacheExpiry(cached.data);
    if (Date.now() - cached.timestamp < cacheExpiry) {
      return cached.data;
    }
  }
  return null;
}

function cacheMatch(matchId: string, data: OnChainMatch) {
  matchCache.set(matchId, { data, timestamp: Date.now() });
}

// Prefetch cache for quick access
const prefetchCache = new Map<string, Promise<OnChainMatch | null>>();

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

export async function fetchMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  matchId: string
): Promise<OnChainMatch | null> {
  if (!contract || !publicClient || !matchId) {
    return null;
  }

  // Check cache first
  const cached = getCachedMatch(matchId);
  if (cached) {
    return cached;
  }

  try {
    // Wrap the actual fetch logic in throttleRequest
    const match = await throttleRequest(async () => {
      // Get base match data
      const baseMatch = (await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches",
        args: [BigInt(matchId)],
      })) as readonly [
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        boolean,
        boolean,
        `0x${string}`
      ];

      // Get 2v2 and 5v5 data to determine match type
      const match2v2Raw = (await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches2v2",
        args: [BigInt(matchId)],
      })) as readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        boolean,
        boolean,
        `0x${string}`
      ];

      const match2v2: Match2v2Response = {
        player1: match2v2Raw[0],
        player2: match2v2Raw[1],
        teamAPlayer2: match2v2Raw[2],
        teamBPlayer2: match2v2Raw[3],
        player1Amount: match2v2Raw[4],
        player2Amount: match2v2Raw[5],
        totalAmount: match2v2Raw[6],
        donatedAmount: match2v2Raw[7],
        isOpen: match2v2Raw[8],
        isERC20: match2v2Raw[9],
        token: match2v2Raw[10],
      };

      const match5v5Raw = (await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches5v5",
        args: [BigInt(matchId)],
      })) as readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
        `0x${string}`,
        boolean,
        boolean
      ];

      const match5v5: Match5v5Response = {
        player1: match5v5Raw[0],
        player2: match5v5Raw[5],
        teamAPlayer2: match5v5Raw[1],
        teamAPlayer3: match5v5Raw[2],
        teamAPlayer4: match5v5Raw[3],
        teamAPlayer5: match5v5Raw[4],
        teamBPlayer2: match5v5Raw[6],
        teamBPlayer3: match5v5Raw[7],
        teamBPlayer4: match5v5Raw[8],
        teamBPlayer5: match5v5Raw[9],
        player1Amount: match5v5Raw[10],
        totalAmount: match5v5Raw[11],
        token: match5v5Raw[12],
        isERC20: match5v5Raw[13],
        isOpen: match5v5Raw[14],
      };

      // Determine match type
      const matchType = determineMatchType(match2v2, match5v5);

      // Initialize players structure
      let players: MatchPlayers = {
        teamA: {
          captain: baseMatch[0],
          player2: null,
          player3: null,
          player4: null,
          player5: null,
        },
        teamB: {
          captain: baseMatch[1],
          player2: null,
          player3: null,
          player4: null,
          player5: null,
        },
      };

      // Update players based on match type
      switch (matchType) {
        case "FIVE_V_FIVE":
          players = {
            teamA: {
              captain: match5v5.player1,
              player2: match5v5.teamAPlayer2,
              player3: match5v5.teamAPlayer3,
              player4: match5v5.teamAPlayer4,
              player5: match5v5.teamAPlayer5,
            },
            teamB: {
              captain: match5v5.player2,
              player2: match5v5.teamBPlayer2,
              player3: match5v5.teamBPlayer3,
              player4: match5v5.teamBPlayer4,
              player5: match5v5.teamBPlayer5,
            },
          };
          break;

        case "TWO_V_TWO":
          players = {
            teamA: {
              captain: match2v2.player1,
              player2: match2v2.teamAPlayer2,
              player3: null,
              player4: null,
              player5: null,
            },
            teamB: {
              captain: match2v2.player2,
              player2: match2v2.teamBPlayer2,
              player3: null,
              player4: null,
              player5: null,
            },
          };
          break;
      }

      // Filter valid addresses for each team
      const teamA = Object.values(players.teamA).filter(
        (addr): addr is `0x${string}` =>
          addr !== null && addr !== "0x0000000000000000000000000000000000000000"
      );
      const teamB = Object.values(players.teamB).filter(
        (addr): addr is `0x${string}` =>
          addr !== null && addr !== "0x0000000000000000000000000000000000000000"
      );

      const result: OnChainMatch = {
        id: BigInt(matchId),
        player1: players.teamA.captain,
        player2: players.teamB.captain,
        player1Amount:
          matchType === "FIVE_V_FIVE"
            ? match5v5.player1Amount
            : match2v2.player1Amount,
        player2Amount:
          matchType === "FIVE_V_FIVE"
            ? match5v5.player1Amount
            : match2v2.player2Amount,
        totalAmount:
          matchType === "FIVE_V_FIVE"
            ? match5v5.totalAmount
            : match2v2.totalAmount,
        donatedAmount: baseMatch[5],
        isOpen:
          matchType === "ONE_V_ONE"
            ? baseMatch[6]
            : matchType === "FIVE_V_FIVE"
            ? match5v5.isOpen
            : match2v2.isOpen,
        isERC20:
          matchType === "FIVE_V_FIVE" ? match5v5.isERC20 : match2v2.isERC20,
        token: matchType === "FIVE_V_FIVE" ? match5v5.token : match2v2.token,
        matchType,
        teamA,
        teamB,
        allPlayers: players,
      };

      return result;
    });

    // Cache the result
    if (match) {
      cacheMatch(matchId, match);
    }

    return match;
  } catch (error) {
    console.error("Error fetching match:", error);
    throw error;
  }
}

export async function fetchMatches(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<OnChainMatch[]> {
  if (!contract || !publicClient) return [];

  try {
    const nextMatchId = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "nextMatchId",
    });

    // Create array of match IDs in reverse order (latest first)
    const totalMatches = Number(nextMatchId) - 1;
    const matchIds = Array.from(
      { length: totalMatches },
      (_, i) => totalMatches - i
    );

    // Apply pagination if options are provided
    const start = options?.offset || 0;
    const end = options?.limit ? start + options?.limit : matchIds.length;
    const paginatedIds = matchIds.slice(start, end);

    // Fetch paginated matches
    const matchPromises = paginatedIds.map((id) =>
      fetchMatch(contract, publicClient, id.toString())
    );

    const matchesData = await Promise.all(matchPromises);
    return matchesData.filter(
      (match): match is NonNullable<typeof match> => match !== null
    );
  } catch (error) {
    console.error("Error fetching matches:", error);
    throw error;
  }
}
