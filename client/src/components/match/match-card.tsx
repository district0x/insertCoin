import React from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { MatchStatusBadge } from "./match-status-badge";

interface MatchCardProps {
  match: OnChainMatch;
  onHover: () => void;
}

const MatchCard = ({ match, onHover }: MatchCardProps) => {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Link
      href={`/matches/${match.id.toString()}`}
      className="block p-6 border rounded-lg hover:border-primary transition-colors"
      onMouseEnter={onHover}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {match.matchType} Match #{match.id.toString()}
          </h3>
          <p className="text-sm text-muted-foreground">
            Prize Pool: {formatEther(match.totalAmount)} {match.isERC20 ? "MTK" : "ETH"}
          </p>
        </div>
        <MatchStatusBadge match={match} />
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">Team A:</p>
          {match.teamA.map((address) => (
            <p key={address} className="text-sm pl-2">
              {truncateAddress(address)}
            </p>
          ))}
        </div>
        {match.teamB.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Team B:</p>
            {match.teamB.map((address) => (
              <p key={address} className="text-sm pl-2">
                {truncateAddress(address)}
              </p>
            ))}
          </div>
        )}
        <p className="text-sm">
          <span className="font-medium">Stake per player:</span>{" "}
          {formatEther(match.player1Amount)} {match.isERC20 ? "MTK" : "ETH"}
        </p>
        {match.donatedAmount > BigInt(0) && (
          <p className="text-sm">
            <span className="font-medium">Donations:</span>{" "}
            {formatEther(match.donatedAmount)} {match.isERC20 ? "MTK" : "ETH"}
          </p>
        )}
      </div>
    </Link>
  );
};

export default MatchCard; 