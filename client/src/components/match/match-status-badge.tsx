import { OnChainMatch } from "@/types/match";
import { getMatchStatus, getMatchStatusColor } from "@/lib/match/types";

interface MatchStatusBadgeProps {
  match: OnChainMatch;
}

export function MatchStatusBadge({ match }: MatchStatusBadgeProps) {
  // Use the utility functions with full match information
  const hasOpponent = match.player2 !== "0x0000000000000000000000000000000000000000";
  const status = getMatchStatus(
    match.isOpen, 
    hasOpponent, 
    match.matchType, 
    match.teamA.length, 
    match.teamB.length
  );
  
  const statusColor = getMatchStatusColor(
    match.isOpen, 
    hasOpponent, 
    match.matchType, 
    match.teamA.length, 
    match.teamB.length
  );

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${statusColor}`}>
      {status}
    </span>
  );
}
