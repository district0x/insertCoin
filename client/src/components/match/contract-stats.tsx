import React, { useEffect, useState } from "react";
import { Coins, Wallet, Trophy } from "lucide-react";

interface ContractStats {
    ethBalance: string;
    ethBalanceUSD: string;
    matchTokenBalance: string;
}

const ContractStats = () => {
    const [stats, setStats] = useState<ContractStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchContractStats = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch('/api/contract/stats');
                if (!response.ok) {
                    throw new Error('Failed to fetch contract stats');
                }

                const data = await response.json();
                setStats(data);
            } catch (error) {
                console.error('Error fetching contract stats:', error);
                setError('Failed to load contract statistics');
            } finally {
                setIsLoading(false);
            }
        };

        fetchContractStats();
    }, []);

    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        <Trophy className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">...</h3>
                <p className="text-gray-300 text-sm mb-1">Loading...</p>
                <p className="text-gray-300 text-sm">MATCH Pool</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        <Trophy className="h-5 w-5 text-red-400" />
                    </div>
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

    if (!stats) {
        return (
            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        <Trophy className="h-5 w-5 text-red-400" />
                    </div>
                </div>
                <div className="text-center py-4">
                    <p className="text-gray-300 text-sm">No data available</p>
                </div>
            </div>
        );
    }

    const ethBalance = parseFloat(stats.ethBalance);
    const ethUsdValue = parseFloat(stats.ethBalanceUSD);
    const matchBalance = parseFloat(stats.matchTokenBalance || "0");

    return (
        <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-full">
                    <Trophy className="h-5 w-5 text-red-400" />
                </div>
            </div>

            {/* Primary Value - MATCH Tokens */}
            <h3 className="text-2xl font-bold text-white mb-2">
                {Math.floor(matchBalance)} MATCH
            </h3>

            {/* Secondary Info - ETH Balance */}
            <div className="mt-4 pt-4 border-t border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                    <Coins className="h-4 w-4 text-red-400" />
                    <span className="text-gray-300 text-sm">ETH Balance</span>
                </div>
                <p className="text-lg font-semibold text-white">
                    ${ethUsdValue.toFixed(2)}
                </p>
                <p className="text-gray-400 text-xs">
                    {ethBalance.toFixed(6)} ETH
                </p>
            </div>
        </div>
    );
};

export default ContractStats; 