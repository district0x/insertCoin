"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OnChainTournament, TournamentStatus } from "../../types/tournament";

export default function TournamentsPage() {
  const { toast } = useToast();
  const contract = useContract();
  const publicClient = usePublicClient();
  const [tournaments, setTournaments] = React.useState<OnChainTournament[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const hasFetchedRef = React.useRef(false);

  // Fetch tournaments from the contract
  React.useEffect(() => {
    // Prevent multiple fetch attempts
    if (hasFetchedRef.current) return;

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError("Timeout loading tournaments. Please try again later.");
        console.log("Tournament loading timed out");
      }
    }, 15000); // 15 second timeout

    async function fetchTournaments() {
      if (!contract || !publicClient) return;

      try {
        hasFetchedRef.current = true;
        setIsLoading(true);
        setError(null);

        // Get the next tournament ID to know how many tournaments exist
        const nextTournamentId = await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "nextTournamentId",
        });

        const tournamentPromises = [];
        // Fetch all tournaments
        for (let i = 1; i < Number(nextTournamentId); i++) {
          tournamentPromises.push(fetchTournament(i));
        }

        const fetchedTournaments = await Promise.all(tournamentPromises);
        // Filter out null results
        setTournaments(
          fetchedTournaments.filter(Boolean) as OnChainTournament[]
        );
      } catch (error) {
        console.error("Error fetching tournaments:", error);
        setError("Failed to load tournaments. Please try again later.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch tournaments. Please try again later.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchTournament(
      tournamentId: number
    ): Promise<OnChainTournament | null> {
      try {
        if (!publicClient || !contract) return null;

        const tournament = (await publicClient.readContract({
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

        // Get number of entrants for this tournament
        const entrantsCount = await getEntrantsCount(tournamentId);

        return {
          id: BigInt(tournamentId),
          winnersPercentage: tournament[0],
          multisigPercentage: tournament[1],
          isActive: tournament[2],
          hasStarted: tournament[3],
          isERC20: tournament[4],
          hasEntryFee: tournament[5],
          numEntrants: tournament[6],
          totalDonations: tournament[7],
          totalTokenDonations: tournament[8],
          remainingBalance: tournament[9],
          entryFee: tournament[10],
          token: tournament[11],
          currentEntrants: entrantsCount,
          status: getTournamentStatus(
            tournament[2],
            tournament[3],
            entrantsCount,
            Number(tournament[6])
          ),
        };
      } catch (error) {
        console.error(`Error fetching tournament ${tournamentId}:`, error);
        return null;
      }
    }

    async function getEntrantsCount(tournamentId: number): Promise<number> {
      // This is a simplification - in a real implementation, you'd need
      // to check each entrant slot until you find an empty one
      try {
        if (!publicClient || !contract) return 0;

        let count = 0;
        const maxEntrants = 64; // Arbitrary upper limit

        for (let i = 0; i < maxEntrants; i++) {
          const entrant = await publicClient.readContract({
            address: contract.address,
            abi: contract.abi,
            functionName: "tournamentEntrants",
            args: [tournamentId, i],
          });

          if (entrant === "0x0000000000000000000000000000000000000000") {
            break;
          }
          count++;
        }

        return count;
      } catch (error) {
        console.error(
          `Error getting entrants count for tournament ${tournamentId}:`,
          error
        );
        return 0;
      }
    }

    fetchTournaments();

    // Cleanup timeout
    return () => clearTimeout(timeoutId);
  }, [contract, publicClient, toast, isLoading]);

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Tournaments</h1>
          <Link
            href="/tournaments/create"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Create Tournament
          </Link>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-4 border border-red-300 bg-red-50 text-red-800 rounded-md">
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              No tournaments found
            </p>
            <p className="mt-2">Be the first to create a tournament!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id.toString()}
                className="p-6 border rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Tournament #{tournament.id.toString()}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Prize Pool:{" "}
                      {formatEther(
                        tournament.totalDonations +
                          tournament.entryFee * BigInt(tournament.numEntrants)
                      )}
                      {tournament.isERC20 ? " Tokens" : " ETH"}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                      tournament.status
                    )}`}
                  >
                    {tournament.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Entry Fee:</span>{" "}
                    {formatEther(tournament.entryFee)}
                    {tournament.isERC20 ? " Tokens" : " ETH"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Players:</span>{" "}
                    {tournament.currentEntrants}/{tournament.numEntrants}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Winners Share:</span>{" "}
                    {tournament.winnersPercentage}%
                  </p>
                </div>
                <div className="mt-4 flex space-x-2">
                  <Link
                    href={`/tournaments/${tournament.id.toString()}`}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground text-center rounded-md"
                  >
                    View Tournament
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
