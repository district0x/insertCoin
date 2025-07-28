import React from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { MatchStatusBadge } from "./match-status-badge";
import { getMatchDisplayTitle } from "@/lib/utils/match-metadata";
import { Users, Trophy, Wallet, Gamepad2, DollarSign } from "lucide-react";

interface MatchCardProps {
  match: OnChainMatch;
  onHover: () => void;
}

const MatchCard = ({ match, onHover }: MatchCardProps) => {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case "ONE_V_ONE": return "1v1";
      case "TWO_V_TWO": return "2v2";
      case "FIVE_V_FIVE": return "5v5";
      default: return type;
    }
  };

  const getMaxPlayers = (type: string) => {
    switch (type) {
      case "ONE_V_ONE": return 2;
      case "TWO_V_TWO": return 4;
      case "FIVE_V_FIVE": return 10;
      default: return 2;
    }
  };

  const currentPlayers = match.teamA.length + match.teamB.length;
  const maxPlayers = getMaxPlayers(match.matchType);

  // Check if match is completed based on available data
  // A match is considered completed if it's not open and has opponents
  const isCompleted = !match.isOpen && match.player2 !== "0x0000000000000000000000000000000000000000";

  // For completed matches, we can't determine the winner from OnChainMatch data
  // This would need to come from the database or a separate API call
  const hasWinner = isCompleted; // Simplified logic for now

  // Get display title with game information
  const displayTitle = getMatchDisplayTitle(match);

  return (
    <Link
      href={`/matches/${match.id.toString()}`}
      className="block bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 hover:shadow-lg transition-all duration-300 group"
      onMouseEnter={onHover}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">
            {displayTitle}
          </h3>
          <p className="text-sm text-gray-300">
            Latest competitive match
          </p>
        </div>
        <MatchStatusBadge match={match} />
      </div>

      {/* Prize Pool - Prominent Display */}
      <div className="bg-gradient-to-r from-red-500/20 to-red-500/10 rounded-lg p-4 mb-4 border border-red-500/20">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-gray-300">Total Prize Pool</span>
        </div>
        <p className="text-xl font-bold text-white">
          {match.isERC20
            ? `${formatEther(match.totalAmount)} MATCH`
            : `$${(parseFloat(formatEther(match.totalAmount)) * 3000).toFixed(2)}`
          }
        </p>
        {!match.isERC20 && (
          <p className="text-xs text-gray-400 mt-1">
            {formatEther(match.totalAmount)} ETH
          </p>
        )}
      </div>

      {/* Key Info Row */}
      <div className="flex justify-between items-center mb-4">
        {/* Entry Fee */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Entry Fee</p>
          <p className="text-sm font-semibold text-white">
            {match.isERC20
              ? `${formatEther(match.player1Amount)} MATCH`
              : `$${(parseFloat(formatEther(match.player1Amount)) * 3000).toFixed(2)}`
            }
          </p>
          {!match.isERC20 && (
            <p className="text-xs text-gray-400">
              {formatEther(match.player1Amount)} ETH
            </p>
          )}
        </div>

        {/* Players */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="h-3 w-3 text-gray-400" />
            <p className="text-xs text-gray-400">Players</p>
          </div>
          <p className="text-sm font-semibold text-white">
            {currentPlayers}/{maxPlayers}
          </p>
        </div>

        {/* Donations */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Donations</p>
          <p className="text-sm font-semibold text-green-400">
            {match.donatedAmount > BigInt(0)
              ? `+${formatEther(match.donatedAmount)} ${match.isERC20 ? "MATCH" : "ETH"}`
              : "None"
            }
          </p>
        </div>
      </div>

      {/* Payouts Section - Only show for completed matches */}
      {isCompleted && hasWinner && (
        <div className="bg-gradient-to-r from-green-500/20 to-green-500/10 rounded-lg p-4 mb-4 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium text-gray-300">Payouts</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Winner:</span>
              <span className="text-sm font-semibold text-green-400">80%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Multisig:</span>
              <span className="text-sm font-semibold text-blue-400">10%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Platform:</span>
              <span className="text-sm font-semibold text-red-400">10%</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-green-500/20">
            <p className="text-xs text-gray-400">Winner:</p>
            <p className="text-xs text-green-400 font-mono">
              View match details for winner info
            </p>
          </div>
        </div>
      )}

      {/* Players List - Simplified */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-3 w-3 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Players</span>
        </div>
        <div className="space-y-1">
          {match.teamA.slice(0, 2).map((address, index) => (
            <div key={address} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
              <p className="text-xs text-gray-300 font-mono">
                {truncateAddress(address)}
              </p>
            </div>
          ))}
          {match.teamB.slice(0, 1).map((address, index) => (
            <div key={address} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
              <p className="text-xs text-gray-300 font-mono">
                {truncateAddress(address)}
              </p>
            </div>
          ))}
          {currentPlayers > 3 && (
            <p className="text-xs text-gray-400 ml-3">
              +{currentPlayers - 3} more players
            </p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="bg-red-600 hover:bg-red-700 text-white text-center py-2 px-4 rounded-lg font-medium transition-all duration-300 group-hover:scale-105">
        View Details
      </div>
    </Link>
  );
};

export default MatchCard; 