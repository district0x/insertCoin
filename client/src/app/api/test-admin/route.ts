import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: "Wallet address is required" },
                { status: 400 }
            );
        }

        console.log(`[TEST-ADMIN] Checking admin status for wallet: ${walletAddress}`);

        // Create a public client
        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
        });

        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        // Check multiple admin-related functions
        const results = await Promise.all([
            // Check if the address is an admin
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "isAdmin",
                args: [walletAddress as `0x${string}`],
            }).catch(e => ({ error: e.message })),

            // Get the contract owner
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "owner",
            }).catch(e => ({ error: e.message })),

            // Try to get all admins (if such function exists)
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "getAdmins",
            }).catch(e => ({ error: e.message })),

            // Check if the address is the owner
            publicClient.readContract({
                address: contractAddress,
                abi: ONEVONE_ABI,
                functionName: "owner",
            }).then(owner => owner === walletAddress).catch(e => ({ error: e.message })),
        ]);

        const [isAdmin, owner, admins, isOwner] = results;

        console.log(`[TEST-ADMIN] Results:`, {
            walletAddress,
            isAdmin,
            owner,
            admins,
            isOwner,
            contractAddress
        });

        return NextResponse.json({
            success: true,
            walletAddress,
            isAdmin,
            contractOwner: owner,
            allAdmins: admins,
            isOwner,
            contractAddress
        });

    } catch (error) {
        console.error("[TEST-ADMIN] Error:", error);
        return NextResponse.json(
            {
                error: "Admin check failed",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
} 