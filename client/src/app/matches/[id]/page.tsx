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
    onSuccess: () => mutate()
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

  console.log("[MatchPage] Rendering match data:", {
    id: displayMatch.id.toString(),
    type: displayMatch.matchType,
    totalAmount: displayMatch.totalAmount.toString(),
    teamA: displayMatch.teamA,
    teamB: displayMatch.teamB,
  });

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
          onClose={handleCloseMatch}
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
    </div>
  );
}
