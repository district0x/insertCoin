"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Trophy, Users, Hash, Calendar, RefreshCw } from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface MatchData {
    id: string;
    matchId: number;
    creatorAddress: string;
    player2Address?: string;
    totalAmount: number;
    isERC20: boolean;
    winner?: string;
    status: string;
    createdAt: string;
    game?: string;
    platform?: string;
    creatorName?: string;
    player2Name?: string;
    playerCount: number;
    stake: number;
}

export default function LatestMatches() {
    const [matches, setMatches] = React.useState<MatchData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [ethPrice, setEthPrice] = React.useState<number | null>(null);

    // Fetch ETH price
    React.useEffect(() => {
        async function fetchEthPrice() {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                if (response.ok) {
                    const data = await response.json();
                    setEthPrice(data.ethereum.usd);
                }
            } catch (err) {
                console.error("Error fetching ETH price:", err);
            }
        }

        fetchEthPrice();
    }, []);

    // Convert ETH to USD
    const convertEthToUsd = React.useCallback((ethAmount: number): string => {
        if (!ethPrice || ethAmount <= 0) return "N/A";
        const usdAmount = ethAmount * ethPrice;
        return `$${usdAmount.toFixed(2)}`;
    }, [ethPrice]);

    // Fetch latest matches from Supabase
    const fetchLatestMatches = React.useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/matches/latest');
            if (!response.ok) {
                throw new Error('Failed to fetch latest matches');
            }

            const data = await response.json();
            console.log('Latest matches API response:', data);
            console.log('Match #16 data:', data.matches?.find((m: MatchData) => m.matchId === 16));

            setMatches(data.matches || []);
        } catch (err) {
            console.error("Error fetching latest matches:", err);
            setError("Failed to load latest matches");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchLatestMatches();
    }, [fetchLatestMatches]);

    // Debug: Log matches when they change
    React.useEffect(() => {
        if (matches.length > 0) {
            console.log('Current matches state:', matches);
            const match16 = matches.find(m => m.matchId === 16);
            if (match16) {
                console.log('Match #16 in component state:', match16);
                console.log('Player count:', match16.playerCount);
                console.log('Player2 address:', match16.player2Address);
            }
        }
    }, [matches]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-red-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-400 mb-4">{error}</p>
            </div>
        );
    }

    if (matches.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-400">No matches found</p>
            </div>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        <Hash className="h-5 w-5 text-red-400" />
                        Latest {matches.length} Completed Matches
                    </CardTitle>
                    <button
                        onClick={fetchLatestMatches}
                        disabled={isLoading}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                        title="Refresh matches"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="text-left py-3 px-4 text-gray-300 font-medium">Match ID</th>
                                <th className="text-left py-3 px-4 text-gray-300 font-medium">Game</th>
                                <th className="text-left py-3 px-4 text-gray-300 font-medium">Players</th>
                                <th className="text-left py-3 px-4 text-gray-300 font-medium">Total</th>
                                <th className="text-left py-3 px-4 text-gray-300 font-medium">Winner</th>
                                <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                                <th className="text-left py-3 px-4 text-gray-300 font-medium">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.map((match) => (
                                <tr key={match.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                                    <td className="py-3 px-4">
                                        <Link
                                            href={`/matches/${match.matchId}`}
                                            className="text-red-400 hover:text-red-300 font-medium hover:underline"
                                        >
                                            #{match.matchId}
                                        </Link>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="text-white text-sm">
                                            {match.game || "N/A"}
                                        </div>
                                        {match.platform && (
                                            <div className="text-gray-400 text-xs">
                                                {match.platform}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-gray-400" />
                                            <span className="text-white">
                                                {match.playerCount}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="text-white font-medium">
                                            {match.totalAmount > 0 ? (
                                                match.isERC20 ? (
                                                    `${match.totalAmount} MATCH`
                                                ) : (
                                                    <div>
                                                        <div>{convertEthToUsd(match.totalAmount)}</div>
                                                        <div className="text-gray-400 text-xs">
                                                            ({match.totalAmount.toFixed(6)} ETH)
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                "N/A"
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        {match.winner && match.winner !== "0x0000000000000000000000000000000000000000" ? (
                                            <div className="flex items-center gap-2">
                                                <Trophy className="h-4 w-4 text-yellow-400" />
                                                <span className="text-white text-sm">
                                                    {match.winner.slice(0, 6)}...{match.winner.slice(-4)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-sm">
                                                No winner recorded
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                                            COMPLETED
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-300 text-sm">
                                                {new Date(match.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
} 