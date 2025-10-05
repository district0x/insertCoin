"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useContract } from "@/lib/hooks/useContract";
import { createPublicClient, http, formatEther } from "viem";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { useVisibilityChange } from "@/lib/hooks/useVisibilityChange";
import { useEthPrice } from "@/lib/hooks/useEthPrice";
import { baseSepolia } from "@/lib/config/chains";
import { Card } from "@/components/ui/card";
import { MatchDonationSuccessDialog } from "@/components/match/match-donation-success-dialog";
import { useMatchData } from "@/hooks/useMatchData";
import { useMatchActions } from "@/hooks/useMatchActions";
import MatchDetailHeader from "@/components/match/match-detail-header";
import MatchDetailContent from "@/components/match/match-detail-content";
import MatchDetailSkeleton from "@/components/match/match-detail-skeleton";
import { useState } from "react";
import { ethers } from "ethers";

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const contract = useContract();

  // Create a public client for reading contract state
  const publicClient = React.useMemo(() => {
    return createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
    });
  }, []);

  const { address } = useWalletConnection();
  const { convertEthToUsd, convertUsdToEth } = useEthPrice();
  const isVisible = useVisibilityChange();

  // State for winner information
  const [winnerInfo, setWinnerInfo] = useState<{
    winnerAddress?: string;
    winnerAmount?: string;
    platformFee?: string;
    multisigFee?: string;
  }>({});

  // State for match metadata (original USD amount and game info)
  const [matchMetadata, setMatchMetadata] = useState<{
    matchAmountUsd?: number;
    game?: string;
    gameCategory?: string;
    creatorUsername?: string;
    player2Username?: string;
  }>({});

  // Debug logging
  React.useEffect(() => {
    console.log("Match page debug info:", {
      matchId,
      hasContract: !!contract,
      hasPublicClient: !!publicClient,
      userAddress: address,
    });
  }, [matchId, contract, publicClient, address]);

  // Fetch match data
  const { match, error, mutate } = useMatchData({
    matchId,
    contract,
    publicClient,
    isVisible
  });

  // Fetch winner information for completed matches
  React.useEffect(() => {
    const fetchWinnerInfo = async () => {
      if (!matchId) return;

      try {
        const response = await fetch(`/api/matches/${matchId}/winner`);
        if (response.ok) {
          const data = await response.json();
          setWinnerInfo({
            winnerAddress: data.winnerAddress,
            winnerAmount: data.winnerAmount,
            platformFee: data.platformFee,
            multisigFee: data.multisigFee,
          });
        }
      } catch (error) {
        console.error("Error fetching winner info:", error);
      }
    };

    fetchWinnerInfo();
  }, [matchId]);

  // Fetch match metadata for original USD amount
  React.useEffect(() => {
    const fetchMatchMetadata = async () => {
      if (!matchId) return;

      try {
        const response = await fetch(`/api/matches/metadata?matchIds=${matchId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.metadata && data.metadata[matchId]) {
            setMatchMetadata({
              matchAmountUsd: data.metadata[matchId].matchAmountUsd,
              game: data.metadata[matchId].game,
              gameCategory: data.metadata[matchId].gameCategory,
              creatorUsername: data.metadata[matchId].creatorUsername,
              player2Username: data.metadata[matchId].player2Username
            });
          }
        }
      } catch (error) {
        console.error("Error fetching match metadata:", error);
      }
    };

    fetchMatchMetadata();
  }, [matchId]);

  // Initialize match actions
  const {
    // State
    isProcessing,
    donationEthAmount,
    showJoinConfirmation,
    showCloseConfirmation,
    selectedWinner,
    lastDonationAmount,
    showSuccessDialog,
    displayMatch,

    // Setters
    setDonationEthAmount,
    setShowJoinConfirmation,
    setShowCloseConfirmation,
    setSelectedWinner,
    setShowSuccessDialog,

    // Handlers
    handleJoinMatch,
    handleDonateToMatch,
    handleCloseMatch
  } = useMatchActions({
    contract,
    publicClient,
    match,
    address: address as `0x${string}` | undefined,
  });

  if (error) {
    console.log("[MatchPage] Rendering error state");
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          Error loading match: {error.message || "Please try again later."}
        </div>
      </div>
    );
  }

  if (!displayMatch) {
    console.log("[MatchPage] Rendering loading state");
    return <MatchDetailSkeleton />;
  }

  // Create a merged match object with metadata
  const matchWithMetadata = {
    ...displayMatch,
    metadata: {
      game: matchMetadata.game || null,
      gameCategory: matchMetadata.gameCategory || null,
      platform: null,
      status: displayMatch.isOpen ? 'OPEN' : 'COMPLETED',
      creatorDiscordId: null,
      creatorAddress: null,
      creatorUsername: matchMetadata.creatorUsername || null,
      opponentDiscordId: null,
      player2Address: null,
      player2Username: matchMetadata.player2Username || null,
      winnerId: null
    }
  };

  console.log("[MatchPage] Rendering match data:", {
    id: displayMatch.id.toString(),
    type: displayMatch.matchType,
    totalAmount: displayMatch.totalAmount.toString(),
    teamA: displayMatch.teamA,
    teamB: displayMatch.teamB,
    metadata: matchWithMetadata.metadata
  });

  // Pass a callback to handleCloseMatch to set the result
  const handleCloseMatchWithResult = async () => {
    const result = await handleCloseMatch();
    if (result) {
      // Refresh winner info after closing match
      setTimeout(() => {
        const fetchWinnerInfo = async () => {
          try {
            const response = await fetch(`/api/matches/${matchId}/winner`);
            if (response.ok) {
              const data = await response.json();
              setWinnerInfo({
                winnerAddress: data.winnerAddress,
                winnerAmount: data.winnerAmount,
                platformFee: data.platformFee,
                multisigFee: data.multisigFee,
              });
            }
          } catch (error) {
            console.error("Error fetching winner info:", error);
          }
        };
        fetchWinnerInfo();
      }, 2000); // Wait 2 seconds for database to update
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <MatchDetailHeader
        match={matchWithMetadata}
        convertEthToUsd={convertEthToUsd}
        originalUsdAmount={matchMetadata.matchAmountUsd}
        game={matchMetadata.game}
        gameCategory={matchMetadata.gameCategory}
      />

      <Card>
        <MatchDetailContent
          match={matchWithMetadata}
          isProcessing={isProcessing}
          userAddress={address?.startsWith('0x') ? address as `0x${string}` : undefined}
          donationEthAmount={donationEthAmount}
          onDonationEthChange={setDonationEthAmount}
          onDonate={handleDonateToMatch}
          selectedWinner={selectedWinner}
          onSelectWinner={setSelectedWinner}
          onJoin={handleJoinMatch}
          onClose={handleCloseMatchWithResult}
          showJoinConfirmation={showJoinConfirmation}
          setShowJoinConfirmation={setShowJoinConfirmation}
          showCloseConfirmation={showCloseConfirmation}
          setShowCloseConfirmation={setShowCloseConfirmation}
          convertEthToUsd={convertEthToUsd}
          convertUsdToEth={convertUsdToEth}
          winnerAddress={winnerInfo.winnerAddress}
          winnerAmount={winnerInfo.winnerAmount}
          platformFee={winnerInfo.platformFee}
          multisigFee={winnerInfo.multisigFee}
        />
      </Card>

      <MatchDonationSuccessDialog
        match={displayMatch}
        lastDonationAmount={lastDonationAmount}
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        convertToUsd={convertEthToUsd}
      />

      {/* Payout Information Modal - Show for completed matches with winner info */}
      {winnerInfo.winnerAddress && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Match Results</h2>
            <div className="space-y-4">
              {(() => {
                // Calculate correct amounts - Only apply 80/15/5 split to player stakes, NOT donations
                const totalStake = displayMatch.player1Amount + displayMatch.player2Amount;
                const donations = displayMatch.donatedAmount;
                const totalPrizePool = totalStake + donations;

                // Player stakes get 80/15/5 split
                const winnerStakeShare = (totalStake * 80n) / 100n;
                const contractFee = (totalStake * 15n) / 100n;
                const multisigShare = (totalStake * 5n) / 100n;

                // Donations go 100% to winner (no platform fees)
                const totalWinnerAmount = winnerStakeShare + donations;

                return (
                  <>
                    <div>
                      <h3 className="font-semibold mb-2">Winner</h3>
                      <p className="text-sm text-muted-foreground">Address: {winnerInfo.winnerAddress}</p>
                      <p className="font-semibold">
                        Amount: {formatEther(totalWinnerAmount)} {displayMatch.isERC20 ? "MATCH" : "ETH"}
                      </p>
                      {!displayMatch.isERC20 && (
                        <p className="text-sm text-muted-foreground">
                          ≈ ${convertEthToUsd(totalWinnerAmount).toFixed(2)} USD
                        </p>
                      )}
                      {donations > 0n && (
                        <p className="text-xs text-blue-400">
                          Includes 80% of stakes + 100% of donations
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Platform Fees</h3>
                      <p className="text-sm">
                        Contract Fee: {formatEther(contractFee)} {displayMatch.isERC20 ? "MATCH" : "ETH"}
                      </p>
                      {!displayMatch.isERC20 && (
                        <p className="text-sm text-muted-foreground">
                          ≈ ${convertEthToUsd(contractFee).toFixed(2)} USD
                        </p>
                      )}
                      <p className="text-sm">
                        Multisig: {formatEther(multisigShare)} {displayMatch.isERC20 ? "MATCH" : "ETH"}
                      </p>
                      {!displayMatch.isERC20 && (
                        <p className="text-sm text-muted-foreground">
                          ≈ ${convertEthToUsd(multisigShare).toFixed(2)} USD
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            <button onClick={() => setWinnerInfo({})}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
