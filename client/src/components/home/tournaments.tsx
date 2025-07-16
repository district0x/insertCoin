"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { formatEther, createPublicClient, http } from "viem";
import { Loader2, Users, Trophy, DollarSign, Calendar } from "lucide-react";
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
  const [latestTournament, setLatestTournament] = React.useState<OnChainTournament | null>(null);
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

  // Fetch latest tournament data
  React.useEffect(() => {
    // Prevent multiple fetch attempts
    if (hasFetchedRef.current) return;

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError("Timeout loading tournament. Please try again later.");
        console.log("Tournament loading timed out");
      }
    }, 15000); // 15 second timeout

    async function fetchLatestTournament() {
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

        // Fetch the latest tournament (nextTournamentId - 1)
        const latestId = Number(nextTournamentId) - 1;

        if (latestId < 1) {
          setLatestTournament(null);
          return;
        }

        const tournament = await fetchTournament(latestId);
        setLatestTournament(tournament);
      } catch (err) {
        console.error("Error fetching latest tournament:", err);
        setError("Failed to load tournament");
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

    fetchLatestTournament();

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
        return "bg-blue-500 text-white";
      case "FILLING":
        return "bg-yellow-500 text-white";
      case "FILLED":
        return "bg-purple-500 text-white";
      case "IN_PROGRESS":
        return "bg-green-500 text-white";
      case "COMPLETED":
        return "bg-gray-500 text-white";
      case "CANCELLED":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  }

  // Calculate total prize pool
  const calculateTotalPrizePool = (tournament: OnChainTournament) => {
    const entryFees = tournament.entryFee * BigInt(tournament.currentEntrants);
    return tournament.totalDonations + entryFees;
  };

  // Check if tournament is recent (created in last 24 hours)
  const isRecentTournament = (tournament: OnChainTournament) => {
    // For now, we'll assume tournaments created in the last 24 hours are "new"
    // In a real implementation, you'd check the creation timestamp
    return tournament.currentEntrants < 5; // Simple heuristic
  };

  return (
    <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Latest Tournament
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Join the most recent tournament and compete for amazing prizes
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-400" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{error}</p>
            <Card className="bg-gray-900/80 border-red-500/20 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-white">No Tournament Available</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  No tournaments are currently available. Check back later or create a new tournament!
                </p>
              </CardContent>
              <CardFooter>
                <Link href="/tournaments/create" className="w-full">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    Create Tournament
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        ) : !latestTournament ? (
          <div className="text-center py-8">
            <Card className="bg-gray-900/80 border-red-500/20 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-white">No Tournaments Yet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  Be the first to create a tournament and compete with others!
                </p>
              </CardContent>
              <CardFooter>
                <Link href="/tournaments/create" className="w-full">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    Create First Tournament
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 overflow-hidden hover:border-red-500/40 transition-all duration-300 hover:scale-[1.02]">
              <CardHeader className="relative pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl text-white">
                      Tournament #{latestTournament.id.toString()}
                    </CardTitle>
                    <p className="text-gray-300 mt-1">
                      Latest tournament on the platform
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {/* Live indicator */}
                    {latestTournament.status === "IN_PROGRESS" && (
                      <span className="px-3 py-1 text-sm bg-red-500 text-white rounded-full font-medium animate-pulse">
                        LIVE
                      </span>
                    )}
                    {/* New badge */}
                    {isRecentTournament(latestTournament) && (
                      <span className="px-3 py-1 text-sm bg-green-500 text-white rounded-full font-medium">
                        NEW
                      </span>
                    )}
                    <span
                      className={`px-3 py-1 text-sm rounded-full font-medium ${getStatusColor(
                        latestTournament.status
                      )}`}
                    >
                      {latestTournament.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Prize Pool Section */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-5 w-5 text-red-400" />
                    <h3 className="text-lg font-semibold text-white">Total Prize Pool</h3>
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">
                    {formatEther(calculateTotalPrizePool(latestTournament))} {latestTournament.isERC20 ? "Tokens" : "ETH"}
                  </div>
                  <div className="text-sm text-gray-300">
                    Entry Fees: {formatEther(latestTournament.entryFee * BigInt(latestTournament.currentEntrants))} {latestTournament.isERC20 ? "Tokens" : "ETH"} •
                    Donations: {formatEther(latestTournament.totalDonations)} {latestTournament.isERC20 ? "Tokens" : "ETH"}
                  </div>
                </div>

                {/* Tournament Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Participants */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-5 w-5 text-red-400" />
                      <h3 className="text-lg font-semibold text-white">Participants</h3>
                    </div>
                    <div className="text-2xl font-bold text-white mb-2">
                      {latestTournament.currentEntrants} / {latestTournament.numEntrants}
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            (latestTournament.currentEntrants / Number(latestTournament.numEntrants)) * 100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-300">
                      {latestTournament.hasEntryFee && (
                        <span>Entry Fee: {formatEther(latestTournament.entryFee)} {latestTournament.isERC20 ? "Tokens" : "ETH"}</span>
                      )}
                    </div>
                  </div>

                  {/* Winners & Payouts */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="h-5 w-5 text-red-400" />
                      <h3 className="text-lg font-semibold text-white">Winners & Payouts</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Winners Percentage:</span>
                        <span className="text-white font-semibold">{latestTournament.winnersPercentage}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Multisig Percentage:</span>
                        <span className="text-white font-semibold">{latestTournament.multisigPercentage}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Remaining Balance:</span>
                        <span className="text-white font-semibold">
                          {formatEther(latestTournament.remainingBalance)} {latestTournament.isERC20 ? "Tokens" : "ETH"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex gap-4">
                <Link href={`/tournaments/${latestTournament.id.toString()}`} className="flex-1">
                  <Button variant="outline" className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10">
                    View Details
                  </Button>
                </Link>
                <Link href="/tournaments" className="flex-1">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    Browse All Tournaments
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Create Tournament CTA */}
            <div className="mt-8 text-center">
              <Card className="bg-gray-900/80 border-red-500/20 max-w-md mx-auto">
                <CardContent className="pt-6">
                  <Link href="/tournaments/create" className="w-full">
                    <Button className="w-full bg-red-600 hover:bg-red-700">
                      Create New Tournament
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* StreamTide Section */}
        <div className="mt-12 flex flex-col items-center">
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
