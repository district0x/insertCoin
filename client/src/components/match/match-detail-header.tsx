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

interface MatchDetailHeaderProps {
  match: OnChainMatch;
  convertEthToUsd: (amount: bigint) => number;
}

const MatchDetailHeader = ({ match, convertEthToUsd }: MatchDetailHeaderProps) => {

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
              <CardTitle>
                {match.matchType} Match #{match.id.toString()}
              </CardTitle>
              <CardDescription>
                Prize Pool: {formatEther(match.totalAmount)} {match.isERC20 ? "MATCH" : "ETH"}
                {!match.isERC20 && (
                  <span className="text-muted-foreground ml-1">
                    (≈${convertEthToUsd(match.totalAmount).toFixed(2)})
                  </span>
                )}
                {match.isERC20 && (
                  <span className="text-muted-foreground ml-1">
                    (No USD value)
                  </span>
                )}
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