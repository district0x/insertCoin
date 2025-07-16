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
    onSuccess: () => mutate()
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
  const handleCloseMatchWithResult = async (...args) => {
    const result = await handleCloseMatch(...args);
    if (result && result.winnerAmount && result.poolAmount) {
      setCloseMatchResult({
        winnerAmount: result.winnerAmount,
        poolAmount: result.poolAmount,
        isOpen: true,
      });
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
              Winner Paid: <b>${convertEthToUsd(BigInt(Math.floor(Number(closeMatchResult.winnerAmount) * 1e18))).toFixed(2)} USD</b> (<b>{closeMatchResult.winnerAmount} ETH</b>)
            </p>
            <p>
              Pool Paid: <b>${convertEthToUsd(BigInt(Math.floor(Number(closeMatchResult.poolAmount) * 1e18))).toFixed(2)} USD</b> (<b>{closeMatchResult.poolAmount} ETH</b>)
            </p>
            <button onClick={() => setCloseMatchResult({ ...closeMatchResult, isOpen: false })}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
