"use client";

import * as React from "react";
import { createPublicClient, http, formatEther } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";

// Base Sepolia contract address as fallback
const FALLBACK_CONTRACT_ADDRESS = "0xC24Cea38b8D6e7303DFfA7d5bc309FE5f8FCaD08";

// Environment variable validation
const validateEnvironmentVariables = () => {
    const missingVars = [];

    if (!process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) {
        missingVars.push('NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL');
    }

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
};

interface StatsData {
    matchesCreated: string;
    matchingPool: string;
    matchingPoolUSD: string;
    lastUpdated: number;
}

interface StatsContextType {
    stats: StatsData;
    isLoading: boolean;
    error: string | null;
    refreshStats: () => Promise<void>;
}

const StatsContext = React.createContext<StatsContextType | undefined>(undefined);

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Function to get ETH price in USD (you can replace this with a real API call)
const getETHPrice = async (): Promise<number> => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        return data.ethereum.usd;
    } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        // Fallback to a reasonable estimate
        return 3000;
    }
};

export function StatsProvider({ children }: { children: React.ReactNode }) {
    const [stats, setStats] = React.useState<StatsData>({
        matchesCreated: "0",
        matchingPool: "0",
        matchingPoolUSD: "0",
        lastUpdated: 0
    });
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Create a single public client instance
    const publicClient = React.useMemo(() => {
        try {
            // Validate environment variables
            validateEnvironmentVariables();

            return createPublicClient({
                chain: baseSepolia,
                transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
            });
        } catch (error) {
            console.error("Error creating public client:", error);
            // Return a fallback client or null - this will be handled by error state
            return null;
        }
    }, []);

    // Create a single contract instance
    const contract = React.useMemo(() => {
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || FALLBACK_CONTRACT_ADDRESS;
        return {
            address: contractAddress as `0x${string}`,
            abi: ONEVONE_ABI,
        };
    }, []);

    const fetchStats = React.useCallback(async (forceRefresh = false) => {
        // Check if we have cached data that's still valid
        const now = Date.now();
        if (!forceRefresh && stats.lastUpdated > 0 && (now - stats.lastUpdated) < CACHE_DURATION) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Get matches created (nextMatchId - 1)
            const nextMatchId = await publicClient.readContract({
                address: contract.address,
                abi: contract.abi,
                functionName: "nextMatchId",
            }) as bigint;
            const matchesCreated = Number(nextMatchId) - 1;

            // Get ETH in matching pool
            const matchingPool = await publicClient.readContract({
                address: contract.address,
                abi: contract.abi,
                functionName: "matchingPool",
            }) as bigint;

            // Get ETH price for USD conversion
            const ethPrice = await getETHPrice();
            const matchingPoolEth = formatEther(matchingPool);
            const matchingPoolUSD = (parseFloat(matchingPoolEth) * ethPrice).toFixed(2);

            setStats({
                matchesCreated: matchesCreated.toString(),
                matchingPool: matchingPoolEth,
                matchingPoolUSD: matchingPoolUSD,
                lastUpdated: now
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
            setError("Failed to fetch stats. Please try again later.");

            // Only update stats if we don't have any cached data
            if (stats.lastUpdated === 0) {
                setStats({
                    matchesCreated: "0",
                    matchingPool: "0",
                    matchingPoolUSD: "0",
                    lastUpdated: now
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [publicClient, contract, stats.lastUpdated]);

    const refreshStats = React.useCallback(async () => {
        await fetchStats(true);
    }, [fetchStats]);

    // Initial fetch on mount
    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Set up background refresh every 5 minutes
    React.useEffect(() => {
        const interval = setInterval(() => {
            fetchStats();
        }, CACHE_DURATION);

        return () => clearInterval(interval);
    }, [fetchStats]);

    const value = React.useMemo(() => ({
        stats,
        isLoading,
        error,
        refreshStats
    }), [stats, isLoading, error, refreshStats]);

    return (
        <StatsContext.Provider value={value}>
            {children}
        </StatsContext.Provider>
    );
}

export function useStats() {
    const context = React.useContext(StatsContext);
    if (context === undefined) {
        throw new Error("useStats must be used within a StatsProvider");
    }
    return context;
} 