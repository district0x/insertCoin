"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { formatEther, createPublicClient, http } from "viem";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnChainTournament, TournamentStatus } from "../../types/tournament";
import Image from "next/image";
import { baseSepolia } from "@/lib/config/chains";

export default function Tournaments() {
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
      if (!contract || !publicClient) return;

      try {
        hasFetchedRef.current = true;
        setIsLoading(true);

        // Get the next tournament ID
        const nextTournamentId = await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "nextTournamentId",
        });

        // Fetch most recent 3 tournaments
        const tournamentPromises = [];
        const startIndex = Math.max(1, Number(nextTournamentId) - 3);

        for (let i = startIndex; i < Number(nextTournamentId); i++) {
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
        if (!publicClient || !contract) return null;

        const tournamentData = (await publicClient.readContract({
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

        // Get number of entrants
        let entrantsCount = 0;
        try {
          for (let i = 0; i < 64; i++) {
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
        }

        return {
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
      } catch (e) {
        console.error(`Error fetching tournament ${tournamentId}:`, e);
        return null;
      }
    }

    fetchTournaments();

    // Cleanup timeout
    return () => clearTimeout(timeoutId);
  }, [contract, publicClient, isLoading]);

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
    <section className="py-20 bg-gray-100">
      <div className="container mx-auto px-4">
        <h3 className="text-3xl font-bold text-center mb-12">
          Featured Tournaments
        </h3>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 max-w-3xl mx-auto">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-gray-50 border-dashed">
                  <CardHeader>
                    <CardTitle>Example Tournament</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        This is a placeholder for tournament data. Please check
                        back later.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href="/tournaments" className="w-full">
                      <Button variant="outline" className="w-full">
                        Try Again Later
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No tournaments available at the moment
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 max-w-3xl mx-auto">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-gray-50">
                  <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        Be the first to create a tournament and compete with
                        others!
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href="/tournaments/create" className="w-full">
                      <Button className="w-full">Create Tournament</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {tournaments.map((tournament) => (
              <Card key={tournament.id.toString()} className="overflow-hidden">
                <CardHeader className="relative pb-2">
                  <div className="absolute top-4 right-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                        tournament.status
                      )}`}
                    >
                      {tournament.status}
                    </span>
                  </div>
                  <CardTitle>Tournament #{tournament.id.toString()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xl font-bold">
                        Prize Pool:{" "}
                        {formatEther(
                          tournament.totalDonations +
                          tournament.entryFee *
                          BigInt(tournament.currentEntrants)
                        )}
                        {tournament.isERC20 ? " Tokens" : " ETH"}
                      </p>
                      <p className="text-sm text-gray-600">
                        Entry Fee: {formatEther(tournament.entryFee)}
                        {tournament.isERC20 ? " Tokens" : " ETH"}
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (tournament.currentEntrants /
                              Number(tournament.numEntrants)) *
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>
                        Participants: {tournament.currentEntrants}/
                        {tournament.numEntrants}
                      </span>
                      <span>Winners: {tournament.winnersPercentage}%</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link
                    href={`/tournaments/${tournament.id.toString()}`}
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      View Details
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <div className="max-w-md mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                Create or Join Tournaments
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Link href="/tournaments" className="w-full">
                <Button className="w-full">Browse All Tournaments</Button>
              </Link>
              <Link href="/tournaments/create" className="w-full">
                <Button variant="outline" className="w-full">
                  Create New Tournament
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <Image
            src="/streamtide.png"
            alt="StreamTide Logo"
            width={104}
            height={96}
            className="mb-4"
          />
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() =>
              window.open(
                "https://streamtide.io/profile/0x944C8e0C05aa90C3C03C16b0703fF66e2ecaa2fa",
                "_blank"
              )
            }
          >
            Support us on StreamTide
          </Button>
        </div>
      </div>
    </section>
  );
}
