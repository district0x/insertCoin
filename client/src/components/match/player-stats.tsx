import React, { useEffect, useState } from "react";
import { Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlayerStats {
    address: string;
    totalWins: number;
    totalMatches: number;
}

const PlayerStats = () => {
    const [players, setPlayers] = useState<PlayerStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    useEffect(() => {
        const fetchPlayerStats = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch('/api/players/stats');
                if (!response.ok) {
                    throw new Error('Failed to fetch player stats');
                }

                const data = await response.json();
                setPlayers(data);
            } catch (error) {
                console.error('Error fetching player stats:', error);
                setError('Failed to load player statistics');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlayerStats();
    }, []);

    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        <Trophy className="h-5 w-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Top Players</h3>
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin ml-auto"></div>
                </div>
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex justify-between items-center py-1">
                            <div className="h-3 w-24 bg-gray-600 rounded animate-pulse"></div>
                            <div className="h-3 w-8 bg-gray-600 rounded animate-pulse"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        <Trophy className="h-5 w-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Top Players</h3>
                </div>
                <div className="text-center py-4">
                    <p className="text-red-400 text-sm mb-2">Error loading stats</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-all duration-300 hover:scale-105"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (players.length === 0) {
        return (
            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        <Trophy className="h-5 w-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Top Players</h3>
                </div>
                <div className="text-center py-4">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-300 text-sm">No players yet</p>
                </div>
            </div>
        );
    }

    // Sort players by total wins (descending)
    const sortedPlayers = [...players].sort((a, b) => b.totalWins - a.totalWins);

    return (
        <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-3 bg-red-500/20 rounded-full">
                    <Trophy className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Top Players</h3>
            </div>
            <div className="space-y-2">
                {sortedPlayers.slice(0, 5).map((player, index) => (
                    <div key={player.address} className="flex items-center justify-between py-2 px-3 hover:bg-red-500/10 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-6 h-6 bg-red-500/20 rounded-full text-xs font-bold text-red-400">
                                {index + 1}
                            </div>
                            <span className="font-mono text-sm text-gray-300">
                                {truncateAddress(player.address)}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="font-semibold text-red-400 text-sm">
                                {player.totalWins}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">wins</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerStats; 