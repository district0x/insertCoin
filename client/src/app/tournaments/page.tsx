"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { formatEther, createPublicClient, http } from "viem";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OnChainTournament, TournamentStatus } from "@/types/tournament";
import { baseSepolia } from "@/lib/config/chains";

export default function TournamentsPage() {
  const { toast } = useToast();
  const contract = useContract();
  const [tournaments, setTournaments] = React.useState<OnChainTournament[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const hasFetchedRef = React.useRef(false);

  // Create a public client for reading contract state
  const publicClient = React.useMemo(() => {
    return createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
    });
  }, []);

  // Fetch tournament data
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
      if (!contract) return;

      try {
        hasFetchedRef.current = true;
        setIsLoading(true);

        // Get the next tournament ID to know how many tournaments exist
        const nextTournamentId = await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "nextTournamentId",
        });

        // Fetch all tournaments
        const tournamentPromises = [];
        for (let i = 1; i < Number(nextTournamentId); i++) {
          tournamentPromises.push(fetchTournament(i));
        }

        const fetchedTournaments = await Promise.all(tournamentPromises);
        setTournaments(
          fetchedTournaments.filter(Boolean) as OnChainTournament[]
        );
      } catch (err) {
        console.error("Error fetching tournaments:", err);
        setError("Failed to load tournaments");
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchTournament(
      tournamentId: number
    ): Promise<OnChainTournament | null> {
      try {
        if (!contract) return null;

        const tournament = (await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "tournaments",
          args: [tournamentId],
        })) as [
            number,
            number,
            boolean,
            boolean,
            boolean,
            boolean,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            `0x${string}`
          ];

        // Count current entrants by checking each entrant slot
        // This is a bit inefficient but necessary since we need
        // to check each entrant slot until you find an empty one
        let entrantsCount = 0;
        try {
          if (!contract) return null;

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
            entrantsCount++;
          }
        } catch (e) {
          console.error(
            `Error counting entrants for tournament ${tournamentId}:`,
            e
          );
          entrantsCount = 0;
        }

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
      } catch (e) {
        console.error(`Error fetching tournament ${tournamentId}:`, e);
        return null;
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
