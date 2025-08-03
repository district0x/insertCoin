"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useContract } from "@/lib/hooks/useContract";
import { createPublicClient, http } from "viem";
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
  const { convertEthToUsd } = useEthPrice();
  const isVisible = useVisibilityChange();

  // State for winner information
  const [winnerInfo, setWinnerInfo] = useState<{
    winnerAddress?: string;
    winnerAmount?: string;
    poolAmount?: string;
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
            poolAmount: data.poolAmount,
          });
        }
      } catch (error) {
        console.error("Error fetching winner info:", error);
      }
    };

    fetchWinnerInfo();
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

  const [closeMatchResult, setCloseMatchResult] = useState<{
    winnerAmount: string;
    poolAmount: string;
    isOpen: boolean;
  }>({ winnerAmount: '', poolAmount: '', isOpen: false });

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

  console.log("[MatchPage] Rendering match data:", {
    id: displayMatch.id.toString(),
    type: displayMatch.matchType,
    totalAmount: displayMatch.totalAmount.toString(),
    teamA: displayMatch.teamA,
    teamB: displayMatch.teamB,
  });

  // Pass a callback to handleCloseMatch to set the result
  const handleCloseMatchWithResult = async () => {
    const result = await handleCloseMatch();
    if (result && result.winnerAmount && result.poolAmount) {
      setCloseMatchResult({
        winnerAmount: result.winnerAmount,
        poolAmount: result.poolAmount,
        isOpen: true,
      });

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
                poolAmount: data.poolAmount,
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
        match={displayMatch}
        convertEthToUsd={convertEthToUsd}
      />

      <Card>
        <MatchDetailContent
          match={displayMatch}
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
          winnerAddress={winnerInfo.winnerAddress}
          winnerAmount={winnerInfo.winnerAmount}
          poolAmount={winnerInfo.poolAmount}
        />
      </Card>

      <MatchDonationSuccessDialog
        match={displayMatch}
        lastDonationAmount={lastDonationAmount}
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        convertToUsd={convertEthToUsd}
      />

      {/* Custom modal for match close result */}
      {closeMatchResult.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Match Closed!</h2>
            <p>
              Winner Paid: <b>${convertEthToUsd(BigInt(Math.floor(Number(closeMatchResult.winnerAmount) * 1e18))).toFixed(2)} USD</b> (<b>{closeMatchResult.winnerAmount} {displayMatch.isERC20 ? "MATCH" : "ETH"}</b>)
            </p>
            <p>
              Pool Paid: <b>${convertEthToUsd(BigInt(Math.floor(Number(closeMatchResult.poolAmount) * 1e18))).toFixed(2)} USD</b> (<b>{closeMatchResult.poolAmount} {displayMatch.isERC20 ? "MATCH" : "ETH"}</b>)
            </p>
            <button onClick={() => setCloseMatchResult({ ...closeMatchResult, isOpen: false })}>Close</button>
          </div>
        </div>
      )}

      {/* Payout Information Modal - Show for completed matches with winner info */}
      {winnerInfo.winnerAddress && !closeMatchResult.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Match Results</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Winner</h3>
                <p className="text-sm text-muted-foreground">Address: {winnerInfo.winnerAddress}</p>
                <p className="font-semibold">
                  Amount: {winnerInfo.winnerAmount} {displayMatch.isERC20 ? "MATCH" : "ETH"}
                </p>
                {!displayMatch.isERC20 && (
                  <p className="text-sm text-muted-foreground">
                    ≈ ${convertEthToUsd(BigInt(Math.floor(Number(winnerInfo.winnerAmount || "0") * 1e18))).toFixed(2)} USD
                  </p>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Platform Fees</h3>
                <p className="text-sm">
                  Contract Fee: {winnerInfo.poolAmount} {displayMatch.isERC20 ? "MATCH" : "ETH"}
                </p>
                {!displayMatch.isERC20 && (
                  <p className="text-sm text-muted-foreground">
                    ≈ ${convertEthToUsd(BigInt(Math.floor(Number(winnerInfo.poolAmount || "0") * 1e18))).toFixed(2)} USD
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setWinnerInfo({})}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
