import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";

export async function POST(request: NextRequest) {
    try {
        const { matchId, winner, callerAddress } = await request.json();

        if (!matchId || !winner || !callerAddress) {
            return NextResponse.json(
                { error: "matchId, winner, and callerAddress are required" },
                { status: 400 }
            );
        }

        console.log(`[TEST-CLOSE-MATCH] Testing closeMatch call:`, {
            matchId,
            winner,
            callerAddress
        });

        // Create a public client
        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
        });

        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        // Check multiple admin-related statuses and match existence
        const results = await Promise.all([
            // Check if caller is admin
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "isAdmin",
                args: [callerAddress as `0x${string}`],
            }),

            // Get contract owner
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "owner",
            }),

            // Check if caller is owner
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "owner",
            }).then(owner => owner === callerAddress),

            // Check if match exists in 1v1
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "matches",
                args: [BigInt(matchId)],
            }).then(match => match && match[0] !== '0x0000000000000000000000000000000000000000').catch(() => false),

            // Check if match exists in 2v2
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "matches2v2",
                args: [BigInt(matchId)],
            }).then(match => match && match[0] !== '0x0000000000000000000000000000000000000000').catch(() => false),

            // Check if match exists in 5v5
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "matches6v6",
                args: [BigInt(matchId)],
            }).then(match => match && match[0] !== '0x0000000000000000000000000000000000000000').catch(() => false),

            // Try to simulate the closeMatch call
            publicClient.simulateContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "closeMatch",
                args: [BigInt(matchId), winner as `0x${string}`],
                account: callerAddress as `0x${string}`,
            }).then(() => ({ success: true })).catch(e => ({ error: e.message })),
        ]);

        const [isAdmin, owner, isOwner, match1v1Exists, match2v2Exists, match6v6Exists, closeMatchResult] = results;

        console.log(`[TEST-CLOSE-MATCH] Results:`, {
            callerAddress,
            isAdmin,
            owner,
            isOwner,
            match1v1Exists,
            match2v2Exists,
            match6v6Exists,
            closeMatchResult
        });

        return NextResponse.json({
            success: true,
            callerAddress,
            isAdmin,
            contractOwner: owner,
            isOwner,
            matchExists: {
                match1v1: match1v1Exists,
                match2v2: match2v2Exists,
                match6v6: match6v6Exists
            },
            closeMatchSimulation: closeMatchResult,
            matchId,
            winner
        });

    } catch (error) {
        console.error("[TEST-CLOSE-MATCH] Error:", error);
        return NextResponse.json(
            {
                error: "Close match test failed",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
} 