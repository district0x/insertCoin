import { useState, useCallback } from "react";
import { OnChainMatch } from "@/types/match";
import { useToast } from "@/hooks/use-toast";
import { GetContractReturnType, PublicClient, WalletClient } from "viem";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";
import { getMaxPlayers, getMatchStatus } from "@/lib/match/types";
import {
  joinMatch,
  join2v2Team,
  join5v5Team,
  donateToMatch,
  closeMatch,
} from "@/lib/match/actions";
import { joinMatchInDb } from "@/lib/services/match";

interface UseMatchActionsProps {
  contract: GetContractReturnType<typeof ONEVONE_ABI> | null;
  publicClient: PublicClient | undefined;
  walletClient: WalletClient | undefined;
  address: `0x${string}` | undefined;
  match: OnChainMatch | null;
  onSuccess?: () => void;
}

export function useMatchActions({
  contract,
  publicClient,
  walletClient,
  address,
  match,
  onSuccess
}: UseMatchActionsProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [donationEthAmount, setDonationEthAmount] = useState<bigint>(BigInt(0));
  const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<`0x${string}` | null>(null);
  const [lastDonationAmount, setLastDonationAmount] = useState<bigint>(BigInt(0));
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [optimisticMatch, setOptimisticMatch] = useState<OnChainMatch | null>(null);

  // Get display match (optimistic or actual)
  const displayMatch = optimisticMatch || match;

  // Handle joining a match
  const handleJoinMatch = useCallback(async () => {
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
          variant: "success"
        });

        try {
          console.log(`Updating database for match join: Wallet=${address}, MatchID=${Number(displayMatch.id)}, isTeamA=${isTeamA}`);

          // Update the database with the user joining the match
          const result = await joinMatchInDb({
            walletAddress: address,
            matchId: Number(displayMatch.id),
            isTeamA: displayMatch.matchType !== "ONE_V_ONE" ? isTeamA : undefined
          });

          console.log("Database updated successfully:", result);

          // Additional notification for successful database update
          toast({
            title: "Database Updated",
            description: "Your participation has been recorded.",
            variant: "success",
            duration: 3000
          });

          onSuccess?.();
        } catch (dbError) {
          console.error("Error updating database after joining match:", dbError);

          // Still notify user, but with warning about database
          toast({
            title: "Warning",
            description: "Match joined on blockchain, but database update failed. Some features may not work correctly.",
            variant: "destructive",
            duration: 7000
          });

          // Still call onSuccess since the blockchain transaction succeeded
          onSuccess?.();
        }
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
  }, [contract, walletClient, address, publicClient, displayMatch, toast, onSuccess]);

  // Handle donating to a match
  const handleDonateToMatch = useCallback(async () => {
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
    const hasOpponent = displayMatch.player2 !== "0x0000000000000000000000000000000000000000";
    const status = getMatchStatus(
      displayMatch.isOpen,
      hasOpponent,
      displayMatch.matchType,
      displayMatch.teamA.length,
      displayMatch.teamB.length
    );

    if (status === "Completed") {
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
        }) as [
            `0x${string}`, // player1
            `0x${string}`, // player2
            boolean,       // isComplete
            `0x${string}`, // winner
            bigint,        // matchAmount
            bigint,        // donatedAmount
            boolean,       // isERC20
            `0x${string}`  // token
          ];

        const newDonationAmount = updatedMatch[5] - displayMatch.donatedAmount;

        setLastDonationAmount(newDonationAmount);
        setShowSuccessDialog(true);
        setDonationEthAmount(BigInt(0));
        onSuccess?.();
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
  }, [contract, walletClient, address, donationEthAmount, displayMatch, publicClient, toast, onSuccess]);

  // Handle closing a match (declaring a winner)
  const handleCloseMatch = useCallback(async () => {
    if (
      !contract ||
      !walletClient ||
      !address ||
      !displayMatch ||
      !selectedWinner
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Please select a winner before closing the match",
      });
      return;
    }

    try {
      setIsProcessing(true);

      const hash = await closeMatch(
        contract,
        publicClient!,
        walletClient,
        displayMatch.id,
        selectedWinner
      );

      toast({
        title: "Transaction Submitted",
        description:
          "Your request to close the match has been submitted.",
      });

      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        // Update the database with the match completion
        try {
          // Update the match in the database
          await fetch('/api/matches/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              matchId: Number(displayMatch.id),
              winnerAddress: selectedWinner,
            }),
          });

          toast({
            title: "Match Completed",
            description: `Match has been completed. The winner is ${selectedWinner.slice(0, 6)}...${selectedWinner.slice(-4)}`,
            variant: "success",
          });

          setShowSuccessDialog(true);
          onSuccess?.();
        } catch (dbError) {
          console.error("Error updating match in database:", dbError);
          toast({
            variant: "destructive",
            title: "Database Update Error",
            description: "Match was completed on-chain but failed to update in our database. Please contact support.",
          });
        }
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
    }
  }, [
    contract,
    walletClient,
    address,
    publicClient,
    displayMatch,
    selectedWinner,
    toast,
    onSuccess,
  ]);

  return {
    // State
    isProcessing,
    donationEthAmount,
    showJoinConfirmation,
    showCloseConfirmation,
    selectedWinner,
    lastDonationAmount,
    showSuccessDialog,
    optimisticMatch,
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
  };
} 