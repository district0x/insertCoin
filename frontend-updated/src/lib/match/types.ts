import { MatchType } from "@/types/match";

export interface Match2v2Response {
  player1: `0x${string}`;
  player2: `0x${string}`;
  teamAPlayer2: `0x${string}`;
  teamBPlayer2: `0x${string}`;
  player1Amount: bigint;
  player2Amount: bigint;
  totalAmount: bigint;
  donatedAmount: bigint;
  isOpen: boolean;
  isERC20: boolean;
  token: `0x${string}`;
}

export interface Match5v5Response {
  player1: `0x${string}`;
  player2: `0x${string}`;
  teamAPlayer2: `0x${string}`;
  teamAPlayer3: `0x${string}`;
  teamAPlayer4: `0x${string}`;
  teamAPlayer5: `0x${string}`;
  teamBPlayer2: `0x${string}`;
  teamBPlayer3: `0x${string}`;
  teamBPlayer4: `0x${string}`;
  teamBPlayer5: `0x${string}`;
  player1Amount: bigint;
  totalAmount: bigint;
  token: `0x${string}`;
  isERC20: boolean;
  isOpen: boolean;
}

export interface MatchPlayers {
  teamA: {
    captain: `0x${string}`;
    player2: `0x${string}` | null;
    player3: `0x${string}` | null;
    player4: `0x${string}` | null;
    player5: `0x${string}` | null;
  };
  teamB: {
    captain: `0x${string}`;
    player2: `0x${string}` | null;
    player3: `0x${string}` | null;
    player4: `0x${string}` | null;
    player5: `0x${string}` | null;
  };
}

export function getMaxPlayers(matchType: MatchType): number {
  switch (matchType) {
    case "FIVE_V_FIVE":
      return 5;
    case "TWO_V_TWO":
      return 2;
    default:
      return 1;
  }
}

export function getMatchStatus(isOpen: boolean, hasOpponent: boolean) {
  if (!isOpen) return "Completed";
  if (!hasOpponent) return "Open";
  return "In Progress";
}

export function getMatchStatusColor(isOpen: boolean, hasOpponent: boolean) {
  if (!isOpen) return "bg-gray-100 text-gray-800";
  if (!hasOpponent) return "bg-green-100 text-green-800";
  return "bg-blue-100 text-blue-800";
}

export function determineMatchType(
  match2v2: Match2v2Response,
  match5v5: Match5v5Response
): MatchType {
  // Check if it's a 2v2 match
  if (
    match2v2.player1Amount > BigInt(0) ||
    match2v2.player1 !== "0x0000000000000000000000000000000000000000" ||
    match2v2.teamAPlayer2 !== "0x0000000000000000000000000000000000000000"
  ) {
    return "TWO_V_TWO";
  }

  // Check if it's a 5v5 match
  if (
    match5v5.player1Amount > BigInt(0) ||
    match5v5.player1 !== "0x0000000000000000000000000000000000000000" ||
    match5v5.teamAPlayer2 !== "0x0000000000000000000000000000000000000000"
  ) {
    return "FIVE_V_FIVE";
  }

  // Default to 1v1
  return "ONE_V_ONE";
}
