import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../../contracts/abis/OneVOne";
import { OnChainMatch } from "@/types/match";
import {
  Match2v2Response,
  Match5v5Response,
  MatchPlayers,
  determineMatchType,
} from "../types";
import { throttleRequest } from "../../utils/rateLimit";
import { getCachedMatch, cacheMatch } from "./cache";

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
          matchType === "ONE_V_ONE"
            ? baseMatch[7]
            : matchType === "FIVE_V_FIVE"
            ? match5v5.isERC20
            : match2v2.isERC20,
        token:
          matchType === "ONE_V_ONE"
            ? baseMatch[8]
            : matchType === "FIVE_V_FIVE"
            ? match5v5.token
            : match2v2.token,
        matchType,
        teamA,
        teamB,
        allPlayers: players,
      };

      return result;
    });

    if (match) {
      // Cache the result
      cacheMatch(matchId, match);
    }

    return match;
  } catch (error) {
    return null;
  }
}

// Direct version without throttling for batch operations
export async function fetchMatchDirect(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  matchId: string
): Promise<OnChainMatch | null> {
  // This is a simplified version of fetchMatch that doesn't use throttleRequest
  // It's used by batchFetchMatches to avoid nested throttling
  
  if (!contract || !publicClient || !matchId) {
    return null;
  }

  // Check cache first
  const cached = getCachedMatch(matchId);
  if (cached) {
    return cached;
  }

  // Implementation similar to fetchMatch but without throttleRequest wrapper
  // ... (same implementation as fetchMatch but without the throttleRequest wrapper)
  
  try {
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
        matchType === "ONE_V_ONE"
          ? baseMatch[7]
          : matchType === "FIVE_V_FIVE"
          ? match5v5.isERC20
          : match2v2.isERC20,
      token:
        matchType === "ONE_V_ONE"
          ? baseMatch[8]
          : matchType === "FIVE_V_FIVE"
          ? match5v5.token
          : match2v2.token,
      matchType,
      teamA,
      teamB,
      allPlayers: players,
    };

    // Cache the result
    cacheMatch(matchId, result);
    return result;
  } catch (error) {
    return null;
  }
} 