import { getMatchStatus, getMatchStatusColor } from "@/lib/match/types";
import { OnChainMatch } from "@/types/match";
import { useState, useEffect } from "react";

interface MatchStatusBadgeProps {
  match: OnChainMatch;
}

export function MatchStatusBadge({ match }: MatchStatusBadgeProps) {
  const [databaseStatus, setDatabaseStatus] = useState<string | undefined>();

  // Fetch database status for this match
  useEffect(() => {
    const fetchDatabaseStatus = async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}/status`);
        if (response.ok) {
          const data = await response.json();
          setDatabaseStatus(data.status);
        }
      } catch (error) {
        console.error("Error fetching database status:", error);
      }
    };

    fetchDatabaseStatus();
  }, [match.id]);

  // Use the utility functions with full match information
  const hasOpponent = match.player2 !== "0x0000000000000000000000000000000000000000";
  const status = getMatchStatus(
    match.isOpen,
    hasOpponent,
    match.matchType,
    match.teamA.length,
    match.teamB.length,
    databaseStatus
  );

  const statusColor = getMatchStatusColor(
    match.isOpen,
    hasOpponent,
    match.matchType,
    match.teamA.length,
    match.teamB.length
  );

  // Map status colors to our red theme
  const getBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'in progress':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'completed':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'full':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  return (
    <span className={`px-3 py-1 text-xs rounded-full font-medium backdrop-blur-sm ${getBadgeStyle(status)}`}>
      {status}
    </span>
  );
}
