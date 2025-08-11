import { useState, useCallback } from "react";
import { OnChainMatch } from "@/types/match";
import { useToast } from "@/hooks/use-toast";
import { GetContractReturnType, PublicClient } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";
import { getMaxPlayers, getMatchStatus } from "@/lib/match/types";
import {
  joinMatch,
  join2v2Team,
  join6v6Team,
  donateToMatch,
  closeMatch,
} from "@/lib/match/actions";
import { joinMatchInDb } from "@/lib/services/match";

interface UseMatchActionsProps {
  contract: GetContractReturnType<typeof ONEVONE_ABI> | null;
  publicClient: PublicClient | undefined;
  match: OnChainMatch | null;
  address?: `0x${string}`;
  onSuccess?: () => void;
}

export function useMatchActions({
  contract,
  publicClient,
  match,
  address: userAddress,
  onSuccess
}: UseMatchActionsProps) {
  const { toast } = useToast();
  const { user, sendTransaction } = usePrivy();
  const address = userAddress || (user?.wallet?.address as `0x${string}` | undefined);

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
    if (!contract || !address || !publicClient || !displayMatch) {
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
            sendTransaction,
            displayMatch.id,
            displayMatch.player1Amount,
            address
          );
          break;
        case "TWO_V_TWO":
          hash = await join2v2Team(
            contract,
            publicClient,
            sendTransaction,
            displayMatch.id,
            isTeamA,
            displayMatch.player1Amount
          );
          break;
        case "FIVE_V_FIVE":
          hash = await join6v6Team(
            contract,
            publicClient,
            sendTransaction,
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
  }, [contract, address, publicClient, displayMatch, toast, onSuccess, sendTransaction]);

  // Handle donating to a match
  const handleDonateToMatch = useCallback(async () => {
    if (
      !contract ||
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
        sendTransaction,
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
            bigint, // player1Amount
            bigint, // player2Amount
            bigint, // totalAmount
            bigint, // donatedAmount
            boolean, // isOpen
            boolean, // isERC20
            `0x${string}` // token
          ];

        // Use the actual donation amount that was sent
        const newDonationAmount = donationEthAmount;
        const newTotalAmount = updatedMatch[4]; // totalAmount is at index 4

        console.log('[DONATION-SUCCESS] Debug info:', {
          donationEthAmount: donationEthAmount.toString(),
          newDonationAmount: newDonationAmount.toString(),
          displayMatchDonatedAmount: displayMatch.donatedAmount.toString(),
          updatedMatchDonatedAmount: updatedMatch[5].toString(),
          newTotalAmount: newTotalAmount.toString()
        });

        // Update optimistic match data with new totals
        setOptimisticMatch({
          ...displayMatch,
          totalAmount: newTotalAmount,
          donatedAmount: updatedMatch[5]
        });

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
  }, [contract, address, donationEthAmount, displayMatch, publicClient, onSuccess, sendTransaction]);

  // Handle closing a match (declaring a winner)
  const handleCloseMatch = useCallback(async () => {
    if (
      !contract ||
      !selectedWinner ||
      !displayMatch ||
      !publicClient
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
      console.log(`[HANDLE-CLOSE-MATCH] Attempting to close match`, {
        matchId: displayMatch.id,
        selectedWinner,
        contractAddress: contract.address
      });
      const userAddress = address as `0x${string}`;
      const hash = await closeMatch(
        contract,
        publicClient,
        sendTransaction,
        displayMatch.id,
        selectedWinner,
        userAddress
      );
      console.log(`[HANDLE-CLOSE-MATCH] closeMatch returned hash:`, hash);
      toast({
        title: "Transaction Submitted",
        description:
          "Your request to close the match has been submitted.",
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[HANDLE-CLOSE-MATCH] Transaction receipt:`, receipt);

      // Parse logs for MatchClosed event and show winner payout
      let winnerPaidEth = null;
      let poolPaidEth = null;
      try {
        const { ethers } = await import("ethers");
        const iface = new ethers.utils.Interface(contract.abi);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed.name === "MatchClosed") {
              winnerPaidEth = ethers.utils.formatEther(parsed.args.winnerAmount.toString());
              poolPaidEth = ethers.utils.formatEther(parsed.args.poolAmount.toString());
              break;
            }
          } catch (e) { }
        }
      } catch (parseErr) {
        console.error("[HANDLE-CLOSE-MATCH] Error parsing MatchClosed event:", parseErr);
      }

      if (winnerPaidEth && poolPaidEth) {
        toast({
          title: "Match Completed",
          description: `Winner paid: ${winnerPaidEth} ETH`,
          variant: "success",
        });
      } else {
        toast({
          title: "Match Completed",
          description: `Match has been completed. The winner is ${selectedWinner.slice(0, 6)}...${selectedWinner.slice(-4)}`,
          variant: "success",
        });
      }

      if (receipt.status === "success") {
        try {
          const dbRes = await fetch('/api/matches/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              matchId: Number(displayMatch.id),
              winnerAddress: selectedWinner,
            }),
          });
          const dbData = await dbRes.json();
          console.log(`[HANDLE-CLOSE-MATCH] /api/matches/complete response:`, dbData);
          onSuccess?.();
        } catch (dbError) {
          console.error("[HANDLE-CLOSE-MATCH] Error updating match in database:", dbError);
          toast({
            variant: "destructive",
            title: "Database Update Error",
            description: "Match was completed on-chain but failed to update in our database. Please contact support.",
          });
        }
      }
      // Return payout info for modal
      return { winnerAmount: winnerPaidEth, poolAmount: poolPaidEth };
    } catch (error) {
      console.error("[HANDLE-CLOSE-MATCH] Error closing match:", error);
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
    publicClient,
    displayMatch,
    selectedWinner,
    address,
    onSuccess,
    sendTransaction,
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
