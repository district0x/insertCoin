import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../../contracts/abis/ABI";
import { OnChainMatch } from "@/types/match";
import {
  Match2v2Response,
  Match5v5Response,
  Match6v6Response,
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
      const baseMatch = await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches",
        args: [BigInt(matchId)],
      }) as readonly [
        `0x${string}`, // player1
        `0x${string}`, // player2
        bigint,        // player1Amount
        bigint,        // player2Amount
        bigint,        // totalAmount
        bigint,        // donatedAmount
        boolean,       // isOpen
        boolean,       // isClosed
        boolean,       // isERC20
        `0x${string}`  // token
      ];

      // Get 2v2 and 5v5 data to determine match type
      const match2v2Raw = await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches2v2",
        args: [BigInt(matchId)],
      }) as readonly [
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

      const match6v6Raw = await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches6v6",
        args: [BigInt(matchId)],
      }) as readonly [
        `0x${string}`, // player1
        `0x${string}`, // teamAPlayer2
        `0x${string}`, // teamAPlayer3
        `0x${string}`, // teamAPlayer4
        `0x${string}`, // teamAPlayer5
        `0x${string}`, // teamAPlayer6
        `0x${string}`, // player2
        `0x${string}`, // teamBPlayer2
        `0x${string}`, // teamBPlayer3
        `0x${string}`, // teamBPlayer4
        `0x${string}`, // teamBPlayer5
        `0x${string}`, // teamBPlayer6
        bigint,        // player1Amount
        bigint,        // totalAmount
        bigint,        // donatedAmount
        `0x${string}`, // token
        boolean,       // isERC20
        boolean,       // isOpen
        boolean        // isClosed
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

      const match6v6: Match6v6Response = {
        player1: match6v6Raw[0],
        player2: match6v6Raw[6],
        teamAPlayer2: match6v6Raw[1],
        teamAPlayer3: match6v6Raw[2],
        teamAPlayer4: match6v6Raw[3],
        teamAPlayer5: match6v6Raw[4],
        teamAPlayer6: match6v6Raw[5],
        teamBPlayer2: match6v6Raw[7],
        teamBPlayer3: match6v6Raw[8],
        teamBPlayer4: match6v6Raw[9],
        teamBPlayer5: match6v6Raw[10],
        teamBPlayer6: match6v6Raw[11],
        player1Amount: match6v6Raw[12],
        totalAmount: match6v6Raw[13],
        donatedAmount: match6v6Raw[14],
        token: match6v6Raw[15],
        isERC20: match6v6Raw[16],
        isOpen: match6v6Raw[17],
      };

      // Determine match type
      const matchType = determineMatchType(match2v2, match6v6);

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
              captain: match6v6.player1,
              player2: match6v6.teamAPlayer2,
              player3: match6v6.teamAPlayer3,
              player4: match6v6.teamAPlayer4,
              player5: match6v6.teamAPlayer5,
            },
            teamB: {
              captain: match6v6.player2,
              player2: match6v6.teamBPlayer2,
              player3: match6v6.teamBPlayer3,
              player4: match6v6.teamBPlayer4,
              player5: match6v6.teamBPlayer5,
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
            ? match6v6.player1Amount
            : matchType === "TWO_V_TWO"
              ? match2v2.player1Amount
              : baseMatch[2],
        player2Amount:
          matchType === "FIVE_V_FIVE"
            ? match6v6.player1Amount
            : matchType === "TWO_V_TWO"
              ? match2v2.player2Amount
              : baseMatch[3],
        totalAmount:
          matchType === "FIVE_V_FIVE"
            ? match6v6.totalAmount
            : matchType === "TWO_V_TWO"
              ? match2v2.totalAmount
              : baseMatch[4],
        donatedAmount: baseMatch[5],
        isOpen:
          matchType === "ONE_V_ONE"
            ? baseMatch[6]
            : matchType === "FIVE_V_FIVE"
              ? match6v6.isOpen
              : match2v2.isOpen,
        isERC20:
          matchType === "ONE_V_ONE"
            ? baseMatch[8]
            : matchType === "FIVE_V_FIVE"
              ? match6v6.isERC20
              : match2v2.isERC20,
        token:
          matchType === "ONE_V_ONE"
            ? baseMatch[9]
            : matchType === "FIVE_V_FIVE"
              ? match6v6.token
              : match2v2.token,
        matchType,
        teamA,
        teamB,
        allPlayers: players,
      };

      // Add debugging for token type
      console.log(`[FETCH-MATCH] Match ${matchId} contract data:`, {
        matchType,
        isERC20: result.isERC20,
        token: result.token,
        isERC20FromBase: baseMatch[8],
        tokenFromBase: baseMatch[9],
        isERC20From2v2: match2v2.isERC20,
        tokenFrom2v2: match2v2.token,
        isERC20From6v6: match6v6.isERC20,
        tokenFrom6v6: match6v6.token,
      });

      // Add detailed logging for debugging
      console.log(`[FETCH-MATCH-DETAILED] Match ${matchId}:`, {
        matchType,
        isERC20: result.isERC20,
        token: result.token,
        totalAmount: result.totalAmount.toString(),
        player1Amount: result.player1Amount.toString(),
        player2Amount: result.player2Amount.toString(),
        isOpen: result.isOpen,
        teamA: result.teamA,
        teamB: result.teamB,
      });

      return result;
    });

    if (match) {
      // Cache the result
      cacheMatch(matchId, match);
    }

    return match;
  } catch (error) {
    console.error(`Failed to fetch match ${matchId}:`, error);
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

    const match6v6Raw = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "matches6v6",
      args: [BigInt(matchId)],
    }) as readonly [
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

    const match6v6: Match6v6Response = {
      player1: match6v6Raw[0],
      player2: match6v6Raw[6],
      teamAPlayer2: match6v6Raw[1],
      teamAPlayer3: match6v6Raw[2],
      teamAPlayer4: match6v6Raw[3],
      teamAPlayer5: match6v6Raw[4],
      teamAPlayer6: match6v6Raw[5],
      teamBPlayer2: match6v6Raw[7],
      teamBPlayer3: match6v6Raw[8],
      teamBPlayer4: match6v6Raw[9],
      teamBPlayer5: match6v6Raw[10],
      teamBPlayer6: match6v6Raw[11],
      player1Amount: match6v6Raw[12],
      totalAmount: match6v6Raw[13],
      token: match6v6Raw[14],
      isERC20: match6v6Raw[15],
      isOpen: match6v6Raw[16],
    };

    // Determine match type
    const matchType = determineMatchType(match2v2, match6v6);

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
            captain: match6v6.player1,
            player2: match6v6.teamAPlayer2,
            player3: match6v6.teamAPlayer3,
            player4: match6v6.teamAPlayer4,
            player5: match6v6.teamAPlayer5,
          },
          teamB: {
            captain: match6v6.player2,
            player2: match6v6.teamBPlayer2,
            player3: match6v6.teamBPlayer3,
            player4: match6v6.teamBPlayer4,
            player5: match6v6.teamBPlayer5,
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
          ? match6v6.player1Amount
          : matchType === "TWO_V_TWO"
            ? match2v2.player1Amount
            : baseMatch[2],
      player2Amount:
        matchType === "FIVE_V_FIVE"
          ? match6v6.player1Amount
          : matchType === "TWO_V_TWO"
            ? match2v2.player2Amount
            : baseMatch[3],
      totalAmount:
        matchType === "FIVE_V_FIVE"
          ? match6v6.totalAmount
          : matchType === "TWO_V_TWO"
            ? match2v2.totalAmount
            : baseMatch[4],
      donatedAmount: baseMatch[5],
      isOpen:
        matchType === "ONE_V_ONE"
          ? baseMatch[6]
          : matchType === "FIVE_V_FIVE"
            ? match6v6.isOpen
            : match2v2.isOpen,
      isERC20:
        matchType === "ONE_V_ONE"
          ? baseMatch[8]
          : matchType === "FIVE_V_FIVE"
            ? match6v6.isERC20
            : match2v2.isERC20,
      token:
        matchType === "ONE_V_ONE"
          ? baseMatch[9]
          : matchType === "FIVE_V_FIVE"
            ? match6v6.token
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
    console.error(`Failed to fetch match ${matchId} directly:`, error);
    return null;
  }
} 