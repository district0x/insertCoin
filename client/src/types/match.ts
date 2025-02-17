import { MatchPlayers } from "@/lib/match/types";

export type MatchType = "ONE_V_ONE" | "TWO_V_TWO" | "FIVE_V_FIVE";

export interface OnChainMatch {
  id: bigint;
  player1: `0x${string}`;
  player2: `0x${string}`;
  player1Amount: bigint;
  player2Amount: bigint;
  totalAmount: bigint;
  donatedAmount: bigint;
  isOpen: boolean;
  isERC20: boolean;
  token: `0x${string}`;
  matchType: MatchType;
  teamA: `0x${string}`[];
  teamB: `0x${string}`[];
  allPlayers: MatchPlayers;
}
