import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { MatchStatusBadge } from "@/components/match/match-status-badge";
import { getMatchTypeLabel } from "@/lib/utils/match-metadata";

interface MatchDetailHeaderProps {
  match: OnChainMatch;
  convertEthToUsd: (amount: bigint) => number;
  originalUsdAmount?: number; // ADD: Original USD amount from database
  game?: string; // ADD: Game name from database
  gameCategory?: string; // ADD: Game category from database
}

const MatchDetailHeader = ({ match, convertEthToUsd, originalUsdAmount, game, gameCategory }: MatchDetailHeaderProps) => {

  // Debug logging to understand the prize pool calculation
  console.log('[MATCH-HEADER] Prize pool debug:', {
    matchId: match.id.toString(),
    totalAmount: match.totalAmount.toString(),
    player1Amount: match.player1Amount.toString(),
    player2Amount: match.player2Amount.toString(),
    donatedAmount: match.donatedAmount.toString(),
    isERC20: match.isERC20,
    player2Joined: match.player2 !== "0x0000000000000000000000000000000000000000",
    totalAmountUSD: convertEthToUsd(match.totalAmount),
    player1AmountUSD: convertEthToUsd(match.player1Amount),
    player2AmountUSD: convertEthToUsd(match.player2Amount)
  });

  return (
    <>
      <Link
        href="/matches"
        className="flex items-center text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Matches
      </Link>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex flex-col gap-1">
                {game && (
                  <span className="text-xl font-bold text-white">
                    {game}
                  </span>
                )}
                <span className="text-lg font-semibold text-gray-300">
                  {getMatchTypeLabel(match.matchType)} Match #{match.id.toString()}
                </span>
              </CardTitle>
              <CardDescription>
                Prize Pool: {formatEther(match.totalAmount)} {match.isERC20 ? "MATCH" : "ETH"}
                {!match.isERC20 && (
                  <span className="text-muted-foreground ml-1">
                    {originalUsdAmount ? (
                      `(≈$${originalUsdAmount.toFixed(2)})`
                    ) : (
                      `(≈${convertEthToUsd(match.totalAmount).toFixed(2)})`
                    )}
                  </span>
                )}
                {match.isERC20 && (
                  <span className="text-muted-foreground ml-1">
                    (No USD value)
                  </span>
                )}
                {/* Debug info */}
                <div className="text-xs text-gray-500 mt-1">
                  Player1: {formatEther(match.player1Amount)} ETH (
                  {originalUsdAmount ?
                    `$${originalUsdAmount.toFixed(2)}` :
                    `$${convertEthToUsd(match.player1Amount).toFixed(2)}`
                  }
                  )
                  {match.player2 !== "0x0000000000000000000000000000000000000000" && (
                    <> | Player2: {formatEther(match.player2Amount)} ETH (${convertEthToUsd(match.player2Amount).toFixed(2)})</>
                  )}
                  {match.donatedAmount > 0n && (
                    <> | Donations: {formatEther(match.donatedAmount)} ETH (${convertEthToUsd(match.donatedAmount).toFixed(2)})</>
                  )}
                </div>
              </CardDescription>
            </div>
            <MatchStatusBadge match={match} />
          </div>
        </CardHeader>
      </Card>
    </>
  );
};

export default MatchDetailHeader; 