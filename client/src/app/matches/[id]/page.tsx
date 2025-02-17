"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useContract } from "@/lib/hooks/useContract";
import { usePublicClient, useWalletClient } from "wagmi";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { formatEther } from "viem";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import useSWR from "swr";
import { MatchStatusBadge } from "@/components/match/match-status-badge";
import { MatchPlayerInfo } from "@/components/match/match-player-info";
import { MatchJoinDialog } from "@/components/match/match-join-dialog";
import { MatchCloseDialog } from "@/components/match/match-close-dialog";
import { MatchDonationDialog } from "@/components/match/match-donation-dialog";
import { MatchDonationSuccessDialog } from "@/components/match/match-donation-success-dialog";
import { fetchMatch } from "@/lib/match/fetch";
import { getMaxPlayers } from "@/lib/match/types";
import {
  joinMatch,
  join2v2Team,
  join5v5Team,
  donateToMatch,
  closeMatch,
} from "@/lib/match/actions";
import { useEthPrice } from "@/lib/hooks/useEthPrice";
import { useVisibilityChange } from "@/lib/hooks/useVisibilityChange";
import { OnChainMatch } from "@/types/match";

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [donationEthAmount, setDonationEthAmount] = React.useState<bigint>(
    BigInt(0)
  );
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [lastDonationAmount, setLastDonationAmount] = React.useState<bigint>(
    BigInt(0)
  );
  const [showJoinConfirmation, setShowJoinConfirmation] = React.useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] =
    React.useState(false);
  const [selectedWinner, setSelectedWinner] = React.useState<
    `0x${string}` | null
  >(null);
  const [optimisticMatch, setOptimisticMatch] = React.useState<OnChainMatch | null>(null);

  const contract = useContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useWalletConnection();
  const { convertEthToUsd } = useEthPrice();
  const isVisible = useVisibilityChange();

  console.log("[MatchPage] Initial render:", {
    matchId,
    hasContract: !!contract,
    hasPublicClient: !!publicClient,
    hasWallet: !!walletClient,
    userAddress: address,
  });

  // Fetch match data with optimistic updates
  const { data: match, error, mutate } = useSWR(
    matchId && contract && publicClient && isVisible
      ? `match-${matchId}`
      : null,
    async () => {
      console.log("[MatchPage] SWR fetcher starting...");
      if (!contract || !publicClient || !matchId) {
        console.log("[MatchPage] Missing dependencies in fetcher");
        return null;
      }

      try {
        const data = await fetchMatch(contract, publicClient, matchId);
        console.log("[MatchPage] Fetched match data:", data);
        if (!data) {
          console.log("[MatchPage] No match data returned");
          return null;
        }
        // Update optimistic state with real data
        setOptimisticMatch(null);
        return data;
      } catch (err) {
        console.error("[MatchPage] Error in SWR fetcher:", err);
        throw err;
      }
    },
    {
      refreshInterval: isVisible ? 30000 : 0,
      revalidateOnFocus: false,
      keepPreviousData: true, // Keep showing old data while loading new data
    }
  );

  // Use optimistic data if available, otherwise use fetched data
  const displayMatch = optimisticMatch || match;

  // Log state changes
  React.useEffect(() => {
    console.log("[MatchPage] Match data updated:", displayMatch);
  }, [displayMatch]);

  React.useEffect(() => {
    if (error) {
      console.error("[MatchPage] Error state:", error);
    }
  }, [error]);

  const handleJoinMatch = async () => {
    if (!contract || !walletClient || !address || !publicClient || !displayMatch) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    try {
      setIsProcessing(true);

      // Create optimistic update
      const optimisticUpdate = { ...displayMatch };
      const requiredPlayers = getMaxPlayers(displayMatch.matchType);
      const teamASpots = requiredPlayers - displayMatch.teamA.length;
      const teamBSpots = requiredPlayers - displayMatch.teamB.length;
      const isTeamA =
        teamASpots > 0 && (teamBSpots === 0 || teamASpots >= teamBSpots);

      // Update teams optimistically
      if (displayMatch.matchType === "ONE_V_ONE") {
        optimisticUpdate.player2 = address;
        optimisticUpdate.teamB = [address];
      } else if (isTeamA) {
        optimisticUpdate.teamA = [...displayMatch.teamA, address];
      } else {
        optimisticUpdate.teamB = [...displayMatch.teamB, address];
      }

      // Apply optimistic update
      setOptimisticMatch(optimisticUpdate);

      let hash;
      switch (displayMatch.matchType) {
        case "ONE_V_ONE":
          hash = await joinMatch(
            contract,
            publicClient,
            walletClient,
            displayMatch.id,
            displayMatch.player1Amount
          );
          break;
        case "TWO_V_TWO":
          hash = await join2v2Team(
            contract,
            publicClient,
            walletClient,
            displayMatch.id,
            isTeamA,
            displayMatch.player1Amount
          );
          break;
        case "FIVE_V_FIVE":
          hash = await join5v5Team(
            contract,
            publicClient,
            walletClient,
            displayMatch.id,
            isTeamA,
            displayMatch.player1Amount
          );
          break;
      }

      toast({
        title: "Transaction Submitted",
        description: "Your request to join the match has been submitted.",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast({
          title: "Success",
          description: "Successfully joined match!",
        });
        mutate(); // Refresh data
      }
    } catch (error) {
      console.error("Error joining match:", error);
      // Revert optimistic update on error
      setOptimisticMatch(null);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to join match. Please try again.",
      });
    } finally {
      setIsProcessing(false);
      setShowJoinConfirmation(false);
    }
  };

  const handleDonateToMatch = async () => {
    if (
      !contract ||
      !walletClient ||
      !address ||
      !donationEthAmount ||
      !displayMatch ||
      !publicClient
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet and enter a donation amount",
      });
      return;
    }

    // Check if match is open before proceeding
    if (!displayMatch.isOpen) {
      toast({
        variant: "destructive",
        title: "Match Closed",
        description: "This match is no longer accepting donations.",
      });
      return;
    }

    try {
      setIsProcessing(true);

      const hash = await donateToMatch(
        contract,
        publicClient,
        walletClient,
        displayMatch.id,
        donationEthAmount
      );

      toast({
        title: "Transaction Submitted",
        description: "Your donation has been submitted.",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        // Get the updated match data to confirm the donation amount
        const updatedMatch = await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "matches",
          args: [displayMatch.id],
        });
        const newDonationAmount = updatedMatch[5] - displayMatch.donatedAmount;

        setLastDonationAmount(newDonationAmount);
        setShowSuccessDialog(true);
        setDonationEthAmount(BigInt(0));
        mutate();
      }
    } catch (error) {
      console.error("Error donating to match:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to donate. Please try again.";

      // Handle specific error cases
      if (errorMessage.includes("Match is closed")) {
        toast({
          variant: "destructive",
          title: "Match Closed",
          description: "This match is no longer accepting donations.",
        });
      } else if (errorMessage.includes("insufficient funds")) {
        toast({
          variant: "destructive",
          title: "Insufficient Funds",
          description:
            "You don't have enough ETH to cover the donation amount and gas fees.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseMatch = async () => {
    if (
      !contract ||
      !walletClient ||
      !address ||
      !publicClient ||
      !displayMatch ||
      !selectedWinner
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet and select a winner",
      });
      return;
    }

    try {
      setIsProcessing(true);

      const hash = await closeMatch(
        contract,
        publicClient,
        walletClient,
        displayMatch.id,
        selectedWinner
      );

      toast({
        title: "Transaction Submitted",
        description: "Your request to close the match has been submitted.",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast({
          title: "Success",
          description: "Successfully closed match!",
        });
        mutate();
      }
    } catch (error) {
      console.error("Error closing match:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to close match. Please try again.",
      });
    } finally {
      setIsProcessing(false);
      setShowCloseConfirmation(false);
      setSelectedWinner(null);
    }
  };

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
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/matches"
          className="flex items-center text-sm text-muted-foreground mb-6 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Matches
        </Link>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
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
                {displayMatch.matchType} Match #{displayMatch.id.toString()}
              </CardTitle>
              <CardDescription>
                Prize Pool: {formatEther(displayMatch.totalAmount)} ETH
                <span className="text-muted-foreground ml-1">
                  (≈${convertEthToUsd(displayMatch.totalAmount).toFixed(2)})
                </span>
              </CardDescription>
            </div>
            <MatchStatusBadge match={displayMatch} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MatchPlayerInfo
                addresses={displayMatch.teamA}
                stake={displayMatch.player1Amount}
                label="Team A"
                maxPlayers={getMaxPlayers(displayMatch.matchType)}
                convertToUsd={convertEthToUsd}
              />
              <MatchPlayerInfo
                addresses={displayMatch.teamB}
                stake={displayMatch.player2Amount}
                label="Team B"
                maxPlayers={getMaxPlayers(displayMatch.matchType)}
                convertToUsd={convertEthToUsd}
              />
            </div>

            {displayMatch.donatedAmount > BigInt(0) && (
              <div>
                <h3 className="font-medium mb-2">Donations</h3>
                <p className="text-sm">
                  {formatEther(displayMatch.donatedAmount)} ETH
                  <span className="text-muted-foreground ml-1">
                    (≈${convertEthToUsd(displayMatch.donatedAmount).toFixed(2)})
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              {displayMatch.isOpen && (
                <MatchJoinDialog
                  match={displayMatch}
                  isProcessing={isProcessing}
                  userAddress={address}
                  onJoin={handleJoinMatch}
                  open={showJoinConfirmation}
                  onOpenChange={setShowJoinConfirmation}
                  convertToUsd={convertEthToUsd}
                />
              )}

              <MatchDonationDialog
                match={displayMatch}
                isProcessing={isProcessing}
                donationEthAmount={donationEthAmount}
                onDonationEthChange={setDonationEthAmount}
                onDonate={handleDonateToMatch}
                convertToUsd={convertEthToUsd}
              />

              {displayMatch.isOpen && displayMatch.teamB.length > 0 && (
                <MatchCloseDialog
                  match={displayMatch}
                  isProcessing={isProcessing}
                  selectedWinner={selectedWinner}
                  onSelectWinner={setSelectedWinner}
                  onClose={handleCloseMatch}
                  open={showCloseConfirmation}
                  onOpenChange={setShowCloseConfirmation}
                  convertToUsd={convertEthToUsd}
                />
              )}
            </div>
          </div>
        </CardContent>
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
