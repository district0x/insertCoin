import { OnChainMatch } from "@/types/match";

interface MatchStatusBadgeProps {
  match: OnChainMatch;
}

export function MatchStatusBadge({ match }: MatchStatusBadgeProps) {
  const getStatusText = (match: OnChainMatch) => {
    if (!match.isOpen) return "Completed";
    if (match.player2 === "0x0000000000000000000000000000000000000000")
      return "Open";
    return "In Progress";
  };

  const getStatusColor = (match: OnChainMatch) => {
    if (!match.isOpen) return "bg-gray-100 text-gray-800";
    if (match.player2 === "0x0000000000000000000000000000000000000000")
      return "bg-green-100 text-green-800";
    return "bg-blue-100 text-blue-800";
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(match)}`}>
      {getStatusText(match)}
    </span>
  );
}
