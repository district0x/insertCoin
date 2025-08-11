"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseUnits } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { MATCH_TOKEN } from "@/lib/constants/tokens";

// Minimal ERC-20 ABI for balanceOf
const ERC20_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

// Environment variable validation
const validateEnvironmentVariables = () => {
    if (!process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) {
        throw new Error('Missing required environment variable: NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL');
    }
};

export function useMatchTokenBalance(address?: `0x${string}` | null) {
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchBalance = async () => {
            if (!address) {
                setBalance(null);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // Validate environment variables
                validateEnvironmentVariables();

                const client = createPublicClient({
                    chain: baseSepolia,
                    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
                });

                const rawBalance = (await client.readContract({
                    address: MATCH_TOKEN.address,
                    abi: ERC20_ABI,
                    functionName: "balanceOf",
                    args: [address],
                })) as bigint;

                // Format to human-readable MATCH amount with up to 2 decimals
                const formatted = Number(rawBalance) / Math.pow(10, MATCH_TOKEN.decimals);
                const display = formatted < 1 ? formatted.toFixed(4) : formatted.toFixed(2);

                if (isMounted) {
                    setBalance(display);
                }
            } catch (e) {
                if (isMounted) {
                    setError(e instanceof Error ? e.message : String(e));
                    setBalance(null);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchBalance();

        // Refresh on interval (optional): every 30s
        const interval = setInterval(fetchBalance, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [address]);

    return { balance, isLoading, error };
} 