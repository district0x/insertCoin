"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import { formatEther, parseEther } from "viem";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OnChainTournament, TournamentStatus } from "../../../types/tournament";

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const contract = useContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const [tournament, setTournament] = React.useState<OnChainTournament | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entrants, setEntrants] = React.useState<string[]>([]);
  const hasFetchedRef = React.useRef(false);
  const isLoadingRef = React.useRef(isLoading);

  // Update ref when isLoading changes
  React.useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Donation state
  const [donationAmount, setDonationAmount] = React.useState("");
  const [isSubmittingDonation, setIsSubmittingDonation] = React.useState(false);
  const [isShowingDonationModal, setIsShowingDonationModal] =
    React.useState(false);

  // Join tournament state
  const [isJoining, setIsJoining] = React.useState(false);
  const [userIsParticipant, setUserIsParticipant] = React.useState(false);

  const tournamentId = Number(params.id);

  // Fetch tournament details
  React.useEffect(() => {
    // Prevent multiple fetch attempts
    if (hasFetchedRef.current) return;

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoadingRef.current) {
        setIsLoading(false);
        setError("Timeout loading tournament details. Please try again later.");
        console.log("Tournament detail loading timed out");
      }
    }, 15000); // 15 second timeout

    async function fetchTournament() {
      if (!contract || !publicClient || !tournamentId) return;

      try {
        hasFetchedRef.current = true;
        setIsLoading(true);
        setError(null);

        const tournamentData = (await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "tournaments",
          args: [tournamentId],
        })) as [
          number, // winnersPercentage
          number, // multisigPercentage
          boolean, // isActive
          boolean, // hasStarted
          boolean, // isERC20
          boolean, // hasEntryFee
          bigint, // numEntrants
          bigint, // totalDonations
          bigint, // totalTokenDonations
          bigint, // remainingBalance
          bigint, // entryFee
          `0x${string}` // token
        ];

        // Get entrants
        const fetchedEntrants = await fetchEntrants(tournamentId);
        setEntrants(fetchedEntrants);

        // Check if user is participant
        if (address) {
          const isParticipant = (await publicClient.readContract({
            address: contract.address,
            abi: contract.abi,
            functionName: "isEntrantInTournament",
            args: [tournamentId, address],
          })) as boolean;

          setUserIsParticipant(isParticipant);
        }

        const entrantsCount = fetchedEntrants.length;

        const tournamentObj: OnChainTournament = {
          id: BigInt(tournamentId),
          winnersPercentage: tournamentData[0],
          multisigPercentage: tournamentData[1],
          isActive: tournamentData[2],
          hasStarted: tournamentData[3],
          isERC20: tournamentData[4],
          hasEntryFee: tournamentData[5],
          numEntrants: tournamentData[6],
          totalDonations: tournamentData[7],
          totalTokenDonations: tournamentData[8],
          remainingBalance: tournamentData[9],
          entryFee: tournamentData[10],
          token: tournamentData[11],
          currentEntrants: entrantsCount,
          status: getTournamentStatus(
            tournamentData[2],
            tournamentData[3],
            entrantsCount,
            Number(tournamentData[6])
          ),
        };

        setTournament(tournamentObj);
      } catch (error) {
        console.error("Error fetching tournament:", error);
        setError("Failed to load tournament details. Please try again later.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch tournament details.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchEntrants(tournamentId: number): Promise<string[]> {
      try {
        if (!publicClient || !contract) return [];

        const entrants: string[] = [];
        const maxEntrants = 64; // Arbitrary upper limit

        for (let i = 0; i < maxEntrants; i++) {
          const entrant = (await publicClient.readContract({
            address: contract.address,
            abi: contract.abi,
            functionName: "tournamentEntrants",
            args: [tournamentId, i],
          })) as string;

          if (entrant === "0x0000000000000000000000000000000000000000") {
            break;
          }

          entrants.push(entrant);
        }

        return entrants;
      } catch (error) {
        console.error(
          `Error fetching entrants for tournament ${tournamentId}:`,
          error
        );
        return [];
      }
    }

    fetchTournament();

    // Cleanup timeout
    return () => clearTimeout(timeoutId);
  }, [contract, publicClient, tournamentId, address, toast]);

  // Helper function to determine tournament status
  function getTournamentStatus(
    isActive: boolean,
    hasStarted: boolean,
    currentEntrants: number,
    maxEntrants: number
  ): TournamentStatus {
    if (!isActive) return "CANCELLED";
    if (hasStarted) return "IN_PROGRESS";
    if (currentEntrants >= maxEntrants) return "FILLED";
    if (currentEntrants > 0) return "FILLING";
    return "CREATED";
  }

  // Get appropriate status badge color
  function getStatusColor(status: TournamentStatus): string {
    switch (status) {
      case "CREATED":
        return "bg-blue-100 text-blue-800";
      case "FILLING":
        return "bg-yellow-100 text-yellow-800";
      case "FILLED":
        return "bg-purple-100 text-purple-800";
      case "IN_PROGRESS":
        return "bg-green-100 text-green-800";
      case "COMPLETED":
        return "bg-gray-100 text-gray-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  // Handle donation modal
  const openDonationModal = () => {
    setIsShowingDonationModal(true);
  };

  const closeDonationModal = () => {
    setIsShowingDonationModal(false);
    setDonationAmount("");
  };

  // Handle donation submission
  const handleDonateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !contract ||
      !walletClient ||
      !address ||
      !tournamentId ||
      !publicClient ||
      !tournament
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid donation amount",
      });
      return;
    }

    try {
      setIsSubmittingDonation(true);

      // Convert donation to wei
      const donationWei = parseEther(donationAmount);

      // Donate to tournament
      const { request } = await publicClient.simulateContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "donate",
        args: [BigInt(tournamentId)],
        account: address,
        value: donationWei,
      });

      const hash = await walletClient.writeContract(request);

      toast({
        title: "Transaction Submitted",
        description: "Your donation transaction has been submitted.",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        // Update total prize in the database
        try {
          // Calculate new prize pool
          const newTotalPrize = parseFloat(
            formatEther(tournament.totalDonations + donationWei)
          );

          const response = await fetch("/api/tournaments/prize", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tournamentId: tournamentId,
              totalPrize: newTotalPrize,
            }),
          });

          if (!response.ok) {
            console.error("Failed to update tournament prize in database");
          }
        } catch (dbError) {
          console.error(
            "Error updating tournament prize in database:",
            dbError
          );
        }

        toast({
          title: "Success",
          description: "Donation sent successfully!",
          variant: "success",
        });

        closeDonationModal();

        // Refresh tournament data
        router.refresh();
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Error donating to tournament:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to donate to tournament",
      });
    } finally {
      setIsSubmittingDonation(false);
    }
  };

  // Handle joining tournament
  const handleJoinTournament = async () => {
    if (
      !contract ||
      !walletClient ||
      !address ||
      !tournament ||
      !publicClient
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    try {
      setIsJoining(true);

      // Join tournament
      const { request } = await publicClient.simulateContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "joinTournament",
        args: [tournament.id],
        account: address,
        value: tournament.entryFee,
      });

      const hash = await walletClient.writeContract(request);

      toast({
        title: "Transaction Submitted",
        description: "Your tournament join transaction has been submitted.",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        // Sync with database - add participant
        try {
          const response = await fetch("/api/tournaments/participant", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tournamentId: Number(tournament.id),
              walletAddress: address,
            }),
          });

          if (!response.ok) {
            console.error(
              "Failed to add participant to tournament in database"
            );
          }

          // Update tournament status if needed
          const updatedEntrantsCount = tournament.currentEntrants + 1;
          if (updatedEntrantsCount >= Number(tournament.numEntrants)) {
            // Tournament is now filled
            const statusResponse = await fetch("/api/tournaments/status", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                tournamentId: Number(tournament.id),
                status: "FILLED",
              }),
            });

            if (!statusResponse.ok) {
              console.error("Failed to update tournament status in database");
            }
          } else if (
            tournament.status === "CREATED" &&
            updatedEntrantsCount > 0
          ) {
            // Tournament is now filling
            const statusResponse = await fetch("/api/tournaments/status", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                tournamentId: Number(tournament.id),
                status: "FILLING",
              }),
            });

            if (!statusResponse.ok) {
              console.error("Failed to update tournament status in database");
            }
          }
        } catch (dbError) {
          console.error("Error updating tournament in database:", dbError);
        }

        toast({
          title: "Success",
          description: "Successfully joined the tournament!",
          variant: "success",
        });

        // Update UI to reflect participation
        setUserIsParticipant(true);

        // Refresh tournament data
        router.refresh();
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Error joining tournament:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to join tournament",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // Truncate ethereum address
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
          <Link
            href="/tournaments"
            className="flex items-center text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Tournaments
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 border border-red-300 bg-red-50 text-red-800 rounded-md">
            {error}
          </div>
        ) : tournament ? (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="w-full md:w-2/3 space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold">
                    Tournament #{tournament.id.toString()}
                  </h1>
                  <span
                    className={`px-3 py-1 text-sm rounded-full ${getStatusColor(
                      tournament.status
                    )}`}
                  >
                    {tournament.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Prize Pool</h3>
                    <p className="text-2xl font-bold">
                      {formatEther(
                        tournament.totalDonations +
                          tournament.entryFee *
                            BigInt(tournament.currentEntrants)
                      )}
                      {tournament.isERC20 ? " Tokens" : " ETH"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Entry Fees:{" "}
                      {formatEther(
                        tournament.entryFee * BigInt(tournament.currentEntrants)
                      )}
                      {tournament.isERC20 ? " Tokens" : " ETH"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Donations: {formatEther(tournament.totalDonations)}
                      {tournament.isERC20 ? " Tokens" : " ETH"}
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Participants</h3>
                    <div className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      <p className="text-2xl font-bold">
                        {tournament.currentEntrants}/{tournament.numEntrants}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Entry Fee: {formatEther(tournament.entryFee)}{" "}
                      {tournament.isERC20 ? "Tokens" : "ETH"}
                    </p>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-4">Prize Distribution</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Winners Share:</span>
                      <span className="font-medium">
                        {tournament.winnersPercentage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Fee:</span>
                      <span className="font-medium">
                        {tournament.multisigPercentage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining (Pool):</span>
                      <span className="font-medium">
                        {100 -
                          tournament.winnersPercentage -
                          tournament.multisigPercentage}
                        %
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-4">Participants</h3>
                  {entrants.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {entrants.map((entrant) => (
                        <div
                          key={entrant}
                          className={`p-2 text-sm rounded ${
                            entrant.toLowerCase() === address?.toLowerCase()
                              ? "bg-primary/10"
                              : "bg-gray-100"
                          }`}
                        >
                          {truncateAddress(entrant)}
                          {entrant.toLowerCase() === address?.toLowerCase() &&
                            " (You)"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No participants yet</p>
                  )}
                </div>
              </div>

              <div className="w-full md:w-1/3 space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-4">Actions</h3>

                  {(tournament.status === "CREATED" ||
                    tournament.status === "FILLING") &&
                    !userIsParticipant && (
                      <button
                        onClick={handleJoinTournament}
                        disabled={isJoining}
                        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center justify-center mb-3"
                      >
                        {isJoining ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Joining...
                          </>
                        ) : (
                          "Join Tournament"
                        )}
                      </button>
                    )}

                  {userIsParticipant && (
                    <div className="p-3 bg-green-100 text-green-800 rounded-md mb-3 text-center">
                      You are participating in this tournament
                    </div>
                  )}

                  <button
                    onClick={openDonationModal}
                    className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md"
                  >
                    Donate to Prize Pool
                  </button>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Tournament Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span>{tournament.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Started:</span>
                      <span>{tournament.hasStarted ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Token Type:</span>
                      <span>{tournament.isERC20 ? "ERC20" : "ETH"}</span>
                    </div>
                    {tournament.isERC20 && (
                      <div className="flex justify-between">
                        <span>Token Address:</span>
                        <span className="truncate max-w-[150px]">
                          {truncateAddress(tournament.token)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Donation Modal */}
            {isShowingDonationModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-background p-6 rounded-lg w-full max-w-md">
                  <h2 className="text-xl font-bold mb-4">
                    Donate to Tournament
                  </h2>

                  <form onSubmit={handleDonateSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="amount" className="text-sm font-medium">
                        Amount ({tournament.isERC20 ? "Tokens" : "ETH"})
                      </label>
                      <input
                        id="amount"
                        type="text"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(e.target.value)}
                        placeholder="0.1"
                        className="w-full p-2 border rounded-md"
                        required
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={closeDonationModal}
                        className="px-4 py-2 border rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingDonation}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center"
                      >
                        {isSubmittingDonation ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Donating...
                          </>
                        ) : (
                          "Donate"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              Tournament not found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
