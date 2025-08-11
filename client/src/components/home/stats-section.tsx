"use client";

import * as React from "react";
import { Coins, Users, Trophy } from "lucide-react";

interface ContractStats {
    ethBalance: string;
    ethBalanceUSD: string;
    matchTokenBalance: string;
}

interface StatCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    isLoading?: boolean;
}

function StatCard({ title, value, subtitle, icon, isLoading }: StatCardProps) {
    return (
        <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-full">
                    {icon}
                </div>
                {isLoading && (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                )}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
                {isLoading ? "..." : value}
            </h3>
            {subtitle && (
                <p className="text-gray-300 text-sm mb-1">{subtitle}</p>
            )}
            <p className="text-gray-300 text-sm">{title}</p>
        </div>
    );
}

export default function StatsSection() {
    const [stats, setStats] = React.useState<ContractStats | null>(null);
    const [matchesCreated, setMatchesCreated] = React.useState<string>("0");
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchStats = React.useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Fetch contract stats (ETH and MATCH tokens)
            const contractResponse = await fetch('/api/contract/stats');
            if (!contractResponse.ok) {
                throw new Error('Failed to fetch contract stats');
            }
            const contractData = await contractResponse.json();
            setStats(contractData);

            // Fetch matches created count
            const matchesResponse = await fetch('/api/matches/count');
            if (matchesResponse.ok) {
                const matchesData = await matchesResponse.json();
                setMatchesCreated(matchesData.count?.toString() || "0");
            } else {
                // Fallback: try to get from contract directly
                const { createPublicClient, http } = await import("viem");
                const { baseSepolia } = await import("@/lib/config/chains");
                const { ONEVONE_ABI } = await import("@/lib/contracts/abis/ABI");

                const publicClient = createPublicClient({
                    chain: baseSepolia,
                    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
                });

                const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xC24Cea38b8D6e7303DFfA7d5bc309FE5f8FCaD08";
                const nextMatchId = await publicClient.readContract({
                    address: contractAddress as `0x${string}`,
                    abi: ONEVONE_ABI,
                    functionName: "nextMatchId",
                }) as bigint;
                setMatchesCreated((Number(nextMatchId) - 1).toString());
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
            setError('Failed to load platform statistics');
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Auto-refresh every 5 minutes
    React.useEffect(() => {
        const interval = setInterval(() => {
            fetchStats();
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(interval);
    }, [fetchStats]);

    const ethBalance = stats ? parseFloat(stats.ethBalance) : 0;
    const ethUsdValue = stats ? parseFloat(stats.ethBalanceUSD) : 0;
    const matchBalance = stats ? parseFloat(stats.matchTokenBalance || "0") : 0;

    return (
        <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Platform Statistics
                    </h2>
                    <p className="text-gray-300 max-w-2xl mx-auto">
                        Track the growth and activity of the Insert Coin gaming platform
                    </p>
                </div>

                {error && (
                    <div className="text-center mb-8">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <StatCard
                        title="Matches Created"
                        value={matchesCreated}
                        icon={<Users className="h-6 w-6 text-red-400" />}
                        isLoading={isLoading}
                    />

                    <StatCard
                        title="MATCH Pool"
                        value={`${Math.floor(matchBalance)} MATCH`}
                        subtitle={`$${ethUsdValue.toFixed(2)} (${ethBalance.toFixed(6)} ETH)`}
                        icon={<Trophy className="h-6 w-6 text-red-400" />}
                        isLoading={isLoading}
                    />
                </div>

                <div className="text-center mt-8">
                    <p className="text-gray-400 text-sm">
                        * Statistics update every 5 minutes
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                        Last updated: {new Date().toLocaleTimeString()}
                    </p>
                </div>
            </div>
        </section>
    );
} 