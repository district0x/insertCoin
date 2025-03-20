import React from "react";
import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { CardContent } from "@/components/ui/card";
import { MatchPlayerInfo } from "@/components/match/match-player-info";
import { MatchJoinDialog } from "@/components/match/match-join-dialog";
import { MatchCloseDialog } from "@/components/match/match-close-dialog";
import { MatchDonationDialog } from "@/components/match/match-donation-dialog";
import { getMaxPlayers, getMatchStatus } from "@/lib/match/types";

interface MatchDetailContentProps {
  match: OnChainMatch;
  isProcessing: boolean;
  userAddress: `0x${string}` | undefined;
  donationEthAmount: bigint;
  onDonationEthChange: (amount: bigint) => void;
  onDonate: () => Promise<void>;
  selectedWinner: `0x${string}` | null;
  onSelectWinner: (address: `0x${string}` | null) => void;
  onJoin: () => Promise<void>;
  onClose: () => Promise<void>;
  showJoinConfirmation: boolean;
  setShowJoinConfirmation: (show: boolean) => void;
  showCloseConfirmation: boolean;
  setShowCloseConfirmation: (show: boolean) => void;
  convertEthToUsd: (amount: bigint) => number;
}

const MatchDetailContent = ({
  match,
  isProcessing,
  userAddress,
  donationEthAmount,
  onDonationEthChange,
  onDonate,
  selectedWinner,
  onSelectWinner,
  onJoin,
  onClose,
  showJoinConfirmation,
  setShowJoinConfirmation,
  showCloseConfirmation,
  setShowCloseConfirmation,
  convertEthToUsd,
}: MatchDetailContentProps) => {
  return (
    <CardContent>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <MatchPlayerInfo
            addresses={match.teamA}
            stake={match.player1Amount}
            label="Team A"
            maxPlayers={getMaxPlayers(match.matchType)}
            convertToUsd={convertEthToUsd}
            isERC20={match.isERC20}
          />
          <MatchPlayerInfo
            addresses={match.teamB}
            stake={match.player2Amount}
            label="Team B"
            maxPlayers={getMaxPlayers(match.matchType)}
            convertToUsd={convertEthToUsd}
            isERC20={match.isERC20}
          />
        </div>

        {match.donatedAmount > BigInt(0) && (
          <div>
            <h3 className="font-medium mb-2">Donations</h3>
            <p className="text-sm">
              {formatEther(match.donatedAmount)} {match.isERC20 ? "MTK" : "ETH"}
              <span className="text-muted-foreground ml-1">
                (≈${convertEthToUsd(match.donatedAmount).toFixed(2)})
              </span>
            </p>
          </div>
        )}

        <div className="space-y-2">
          {(() => {
            const hasOpponent = match.player2 !== "0x0000000000000000000000000000000000000000";
            const status = getMatchStatus(
              match.isOpen,
              hasOpponent,
              match.matchType,
              match.teamA.length,
              match.teamB.length
            );
            
            // Show join dialog for "Open" or "In Progress" matches (unless all spots are filled)
            const maxPlayers = getMaxPlayers(match.matchType);
            const canJoin = status === "Open" || 
                            (status === "In Progress" && 
                             (match.teamA.length < maxPlayers || match.teamB.length < maxPlayers));
            
            return (
              <>
                {canJoin && (
                  <MatchJoinDialog
                    match={match}
                    isProcessing={isProcessing}
                    userAddress={userAddress}
                    onJoin={onJoin}
                    open={showJoinConfirmation}
                    onOpenChange={setShowJoinConfirmation}
                    convertToUsd={convertEthToUsd}
                  />
                )}
        
                <MatchDonationDialog
                  match={match}
                  isProcessing={isProcessing}
                  donationEthAmount={donationEthAmount}
                  onDonationEthChange={onDonationEthChange}
                  onDonate={onDonate}
                  convertToUsd={convertEthToUsd}
                />
        
                {status === "In Progress" && (
                  <MatchCloseDialog
                    match={match}
                    isProcessing={isProcessing}
                    selectedWinner={selectedWinner}
                    onSelectWinner={onSelectWinner}
                    onClose={onClose}
                    open={showCloseConfirmation}
                    onOpenChange={setShowCloseConfirmation}
                    convertToUsd={convertEthToUsd}
                  />
                )}
              </>
            );
          })()}
        </div>
      </div>
    </CardContent>
  );
};

export default MatchDetailContent; 