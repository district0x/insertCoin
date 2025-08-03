import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { OnChainMatch } from "@/types/match";
import { getMaxPlayers, getMatchStatus } from "@/lib/match/types";
import { MatchJoinDialog } from "./match-join-dialog";
import { MatchDonationDialog } from "./match-donation-dialog";
import { MatchCloseDialog } from "./match-close-dialog";
import { MatchPlayerInfo } from "./match-player-info";
import { MatchPayoutInfo } from "./match-payout-info";

interface MatchDetailContentProps {
  match: OnChainMatch;
  isProcessing: boolean;
  userAddress?: `0x${string}`;
  donationEthAmount: bigint;
  onDonationEthChange: (amount: bigint) => void;
  onDonate: () => Promise<void>;
  selectedWinner: `0x${string}` | null;
  onSelectWinner: (winner: `0x${string}`) => void;
  onJoin: () => Promise<void>;
  onClose: () => Promise<void>;
  showJoinConfirmation: boolean;
  setShowJoinConfirmation: (show: boolean) => void;
  showCloseConfirmation: boolean;
  setShowCloseConfirmation: (show: boolean) => void;
  convertEthToUsd: (ethAmount: bigint) => number;
  winnerAddress?: string;
  winnerAmount?: string;
  poolAmount?: string;
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
  winnerAddress,
  winnerAmount,
  poolAmount,
}: MatchDetailContentProps) => {
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

  // Determine match status
  const hasOpponent = match.player2 !== "0x0000000000000000000000000000000000000000";
  const status = getMatchStatus(
    match.isOpen,
    hasOpponent,
    match.matchType,
    match.teamA.length,
    match.teamB.length,
    databaseStatus
  );

  const isCompleted = status === "Completed";

  return (
    <CardContent className="space-y-6">
      {/* Match Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <span className={`px-2 py-1 text-xs rounded-full ${(() => {
            switch (status.toLowerCase()) {
              case 'open':
                return 'bg-green-500/20 text-green-400 border border-green-500/30';
              case 'in progress':
                return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
              case 'completed':
                return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
              default:
                return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
            }
          })()
            }`}>
            {status}
          </span>
        </div>
      </div>

      {/* Payout Information - Show for completed matches or when winner info is available */}
      {(isCompleted || winnerAddress) && (
        <MatchPayoutInfo
          match={match}
          winnerAddress={winnerAddress}
          winnerAmount={winnerAmount}
          poolAmount={poolAmount}
          convertEthToUsd={convertEthToUsd}
        />
      )}

      {/* Players Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Players</h3>

        {/* Team A */}
        <div className="space-y-2">
          <MatchPlayerInfo
            addresses={match.teamA}
            stake={match.player1Amount}
            label="Team A"
            maxPlayers={getMaxPlayers(match.matchType)}
            convertToUsd={convertEthToUsd}
            isERC20={match.isERC20}
          />
        </div>

        {/* Team B */}
        <div className="space-y-2">
          <MatchPlayerInfo
            addresses={match.teamB}
            stake={match.player2Amount}
            label="Team B"
            maxPlayers={getMaxPlayers(match.matchType)}
            convertToUsd={convertEthToUsd}
            isERC20={match.isERC20}
          />
        </div>
      </div>

      {/* Actions Section */}
      <div className="space-y-4">
        {(() => {
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
    </CardContent>
  );
};

export default MatchDetailContent; 