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

export function getMatchStatus(isOpen: boolean, hasOpponent: boolean, matchType?: MatchType, teamALength?: number, teamBLength?: number) {
  // For simple checks without full data (backward compatibility)
  if (matchType === undefined || teamALength === undefined || teamBLength === undefined) {
    if (!isOpen && hasOpponent) return "In Progress";
    if (!isOpen) return "Completed";
    return hasOpponent ? "In Progress" : "Open";
  }
  
  // For 1v1 matches
  if (matchType === "ONE_V_ONE") {
    // If player2 is set but match is not open, it means both players have joined
    // but the match is still in progress (not completed yet)
    if (!isOpen && hasOpponent) return "In Progress";
    
    // If match is not open and no player2, it's completed (rare case)
    if (!isOpen) return "Completed";
    
    // If player2 exists, the match is in progress
    if (hasOpponent) return "In Progress";
    
    // Otherwise, it's still open for joining
    return "Open";
  }
  
  // For team-based matches (2v2, 5v5)
  const maxPlayersPerTeam = getMaxPlayers(matchType);
  const teamAFull = teamALength === maxPlayersPerTeam;
  const teamBFull = teamBLength === maxPlayersPerTeam;
  
  // If match is not open, it's really completed
  if (!isOpen) return "Completed";
  
  // If both teams are full, it's in progress
  if (teamAFull && teamBFull) return "In Progress";
  
  // If any team has at least one player but teams are not full, it's open for more players
  return "Open";
}

export function getMatchStatusColor(isOpen: boolean, hasOpponent: boolean, matchType?: MatchType, teamALength?: number, teamBLength?: number) {
  const status = getMatchStatus(isOpen, hasOpponent, matchType, teamALength, teamBLength);
  
  switch (status) {
    case "Completed":
      return "bg-gray-100 text-gray-800";
    case "Open":
      return "bg-green-100 text-green-800";
    case "In Progress":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
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
