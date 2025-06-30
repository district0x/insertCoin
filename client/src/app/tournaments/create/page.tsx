"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useContract } from "@/lib/hooks/useContract";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { parseEther } from "viem";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { simulateAndSendTransaction } from "@/lib/utils/transaction";

export default function CreateTournament() {
  const router = useRouter();
  const { toast } = useToast();
  const contract = useContract();
  const { user, sendTransaction } = usePrivy();

  // Create public client directly
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
  });

  const address = user?.wallet?.address as `0x${string}` | undefined;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState({
    numEntrants: 8,
    entryFee: "0.1",
    winnersPercentage: 80,
    multisigPercentage: 10,
    token: "0x0000000000000000000000000000000000000000", // Default to ETH
    isERC20: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;

    if (name === "isERC20") {
      setFormData({
        ...formData,
        isERC20: (e.target as HTMLInputElement).checked,
      });
    } else {
      setFormData({
        ...formData,
        [name]: type === "number" ? parseInt(value, 10) : value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contract || !address || !publicClient) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Validate form data
      if (formData.numEntrants < 4 || formData.numEntrants > 64) {
        throw new Error("Number of entrants must be between 4 and 64");
      }

      if (formData.winnersPercentage + formData.multisigPercentage > 100) {
        throw new Error("Total percentage cannot exceed 100%");
      }

      // Convert entry fee to wei
      const entryFeeWei = parseEther(formData.entryFee);

      // Create tournament transaction using type-safe wrapper
      const hash = await simulateAndSendTransaction(
        () => contract.simulate.createTournament(
          [
            BigInt(formData.numEntrants),
            formData.winnersPercentage,
            formData.multisigPercentage,
            formData.token as `0x${string}`,
            entryFeeWei,
          ],
          {
            account: address as `0x${string}`,
          }
        ),
        sendTransaction
      );

      toast({
        title: "Transaction Submitted",
        description: "Your tournament creation transaction has been submitted.",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        // Get the new tournament ID
        const nextTournamentId = await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "nextTournamentId",
        });

        // The ID of our newly created tournament is nextTournamentId - 1
        const tournamentId = Number(nextTournamentId) - 1;

        // Sync with database
        try {
          const response = await fetch("/api/tournaments/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tournamentId: tournamentId,
              status: "CREATED",
              entryFee: parseFloat(formData.entryFee),
              tokenAddress: formData.isERC20 ? formData.token : null,
              totalPrize: 0, // Initial prize pool is 0
              maxParticipants: formData.numEntrants,
              creatorAddress: address,
            }),
          });

          if (!response.ok) {
            console.error("Failed to sync tournament with database");
          }
        } catch (dbError) {
          console.error("Error syncing tournament with database:", dbError);
        }

        toast({
          title: "Success",
          description: "Tournament created successfully!",
          variant: "success",
        });

        // Redirect to tournaments page
        router.push("/tournaments");
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Error creating tournament:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create tournament",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Create Tournament</h1>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="numEntrants" className="text-sm font-medium">
              Maximum Participants
            </label>
            <input
              id="numEntrants"
              name="numEntrants"
              type="number"
              className="w-full p-2 border rounded-md"
              min="4"
              max="64"
              step="4"
              value={formData.numEntrants}
              onChange={handleChange}
              required
            />
            <p className="text-xs text-muted-foreground">
              Must be between 4 and 64 participants
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="entryFee" className="text-sm font-medium">
              Entry Fee (ETH)
            </label>
            <input
              id="entryFee"
              name="entryFee"
              type="text"
              className="w-full p-2 border rounded-md"
              placeholder="0.1"
              value={formData.entryFee}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="winnersPercentage" className="text-sm font-medium">
              Winners Percentage
            </label>
            <input
              id="winnersPercentage"
              name="winnersPercentage"
              type="number"
              className="w-full p-2 border rounded-md"
              min="1"
              max="95"
              value={formData.winnersPercentage}
              onChange={handleChange}
              required
            />
            <p className="text-xs text-muted-foreground">
              Percentage of the prize pool distributed to winners
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="multisigPercentage" className="text-sm font-medium">
              Platform Fee Percentage
            </label>
            <input
              id="multisigPercentage"
              name="multisigPercentage"
              type="number"
              className="w-full p-2 border rounded-md"
              min="1"
              max="20"
              value={formData.multisigPercentage}
              onChange={handleChange}
              required
            />
            <p className="text-xs text-muted-foreground">
              Percentage of the prize pool allocated to the platform
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <input
                id="isERC20"
                name="isERC20"
                type="checkbox"
                className="mr-2"
                checked={formData.isERC20}
                onChange={handleChange}
              />
              <label htmlFor="isERC20" className="text-sm font-medium">
                Use ERC20 Token
              </label>
            </div>

            {formData.isERC20 && (
              <div className="mt-2">
                <label htmlFor="token" className="text-sm font-medium">
                  Token Address
                </label>
                <input
                  id="token"
                  name="token"
                  type="text"
                  className="w-full p-2 border rounded-md mt-1"
                  placeholder="0x..."
                  value={formData.token}
                  onChange={handleChange}
                  required={formData.isERC20}
                />
                <p className="text-xs text-muted-foreground">
                  Address of the ERC20 token contract
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center justify-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Tournament...
              </>
            ) : (
              "Create Tournament"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
