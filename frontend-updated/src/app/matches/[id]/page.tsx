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
import useSWR, { mutate } from "swr";
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

  const contract = useContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useWalletConnection();
  const { convertEthToUsd } = useEthPrice();

  console.log("[MatchPage] Initial render:", {
    matchId,
    hasContract: !!contract,
    hasPublicClient: !!publicClient,
    hasWallet: !!walletClient,
    userAddress: address,
  });

  // Fetch match data
  const { data: match, error } = useSWR(
    matchId && contract && publicClient ? `match-${matchId}` : null,
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
        return data;
      } catch (err) {
        console.error("[MatchPage] Error in SWR fetcher:", err);
        throw err;
      }
    },
    {
      refreshInterval: 5000,
      onSuccess: (data) => {
        console.log("[MatchPage] SWR success:", data);
      },
      onError: (err) => {
        console.error("[MatchPage] SWR error:", err);
      },
    }
  );

  // Log state changes
  React.useEffect(() => {
    console.log("[MatchPage] Match data updated:", match);
  }, [match]);

  React.useEffect(() => {
    if (error) {
      console.error("[MatchPage] Error state:", error);
    }
  }, [error]);

  const handleJoinMatch = async () => {
    if (!contract || !walletClient || !address || !publicClient || !match) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    try {
      setIsProcessing(true);

      // Determine which team to join
      const requiredPlayers = getMaxPlayers(match.matchType);
      const teamASpots = requiredPlayers - match.teamA.length;
      const teamBSpots = requiredPlayers - match.teamB.length;

      // Validate team spots
      if (teamASpots === 0 && teamBSpots === 0) {
        toast({
          variant: "destructive",
          title: "Teams Full",
          description: "This match is already full.",
        });
        return;
      }

      // Determine which team to join for team matches
      const isTeamA =
        teamASpots > 0 && (teamBSpots === 0 || teamASpots >= teamBSpots);

      let hash;
      switch (match.matchType) {
        case "ONE_V_ONE":
          hash = await joinMatch(
            contract,
            publicClient,
            walletClient,
            match.id,
            match.player1Amount
          );
          break;
        case "TWO_V_TWO":
          hash = await join2v2Team(
            contract,
            publicClient,
            walletClient,
            match.id,
            isTeamA,
            match.player1Amount
          );
          break;
        case "FIVE_V_FIVE":
          hash = await join5v5Team(
            contract,
            publicClient,
            walletClient,
            match.id,
            isTeamA,
            match.player1Amount
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
        mutate(`match-${matchId}`);
      }
    } catch (error) {
      console.error("Error joining match:", error);
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
      !match ||
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
    if (!match.isOpen) {
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
        match.id,
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
          args: [match.id],
        });
        const newDonationAmount = updatedMatch[5] - match.donatedAmount;

        setLastDonationAmount(newDonationAmount);
        setShowSuccessDialog(true);
        setDonationEthAmount(BigInt(0));
        mutate(`match-${matchId}`);
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
      !match ||
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
        match.id,
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
        mutate(`match-${matchId}`);
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

  if (!match) {
    console.log("[MatchPage] Rendering loading state");
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  console.log("[MatchPage] Rendering match data:", {
    id: match.id.toString(),
    type: match.matchType,
    totalAmount: match.totalAmount.toString(),
    teamA: match.teamA,
    teamB: match.teamB,
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
                {match.matchType} Match #{match.id.toString()}
              </CardTitle>
              <CardDescription>
                Prize Pool: {formatEther(match.totalAmount)} ETH
                <span className="text-muted-foreground ml-1">
                  (≈${convertEthToUsd(match.totalAmount).toFixed(2)})
                </span>
              </CardDescription>
            </div>
            <MatchStatusBadge match={match} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MatchPlayerInfo
                addresses={match.teamA}
                stake={match.player1Amount}
                label="Team A"
                maxPlayers={getMaxPlayers(match.matchType)}
                convertToUsd={convertEthToUsd}
              />
              <MatchPlayerInfo
                addresses={match.teamB}
                stake={match.player2Amount}
                label="Team B"
                maxPlayers={getMaxPlayers(match.matchType)}
                convertToUsd={convertEthToUsd}
              />
            </div>

            {match.donatedAmount > BigInt(0) && (
              <div>
                <h3 className="font-medium mb-2">Donations</h3>
                <p className="text-sm">
                  {formatEther(match.donatedAmount)} ETH
                  <span className="text-muted-foreground ml-1">
                    (≈${convertEthToUsd(match.donatedAmount).toFixed(2)})
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              {match.isOpen && (
                <MatchJoinDialog
                  match={match}
                  isProcessing={isProcessing}
                  userAddress={address}
                  onJoin={handleJoinMatch}
                  open={showJoinConfirmation}
                  onOpenChange={setShowJoinConfirmation}
                  convertToUsd={convertEthToUsd}
                />
              )}

              <MatchDonationDialog
                match={match}
                isProcessing={isProcessing}
                donationEthAmount={donationEthAmount}
                onDonationEthChange={setDonationEthAmount}
                onDonate={handleDonateToMatch}
                convertToUsd={convertEthToUsd}
              />

              {match.isOpen && match.teamB.length > 0 && (
                <MatchCloseDialog
                  match={match}
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
        match={match}
        lastDonationAmount={lastDonationAmount}
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        convertToUsd={convertEthToUsd}
      />
    </div>
  );
}
