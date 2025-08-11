import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from '@/lib/config/chains';
import { ONEVONE_ABI } from '@/lib/contracts/abis/ABI';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
});

export async function GET(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

        if (!contractAddress) {
            throw new Error('Contract address not configured');
        }

        console.log('[MATCHES-COUNT] Fetching match count for contract:', contractAddress);

        // Get nextMatchId from contract
        const nextMatchId = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: ONEVONE_ABI,
            functionName: "nextMatchId",
        }) as bigint;

        // Calculate matches created (nextMatchId - 1)
        const matchesCreated = Number(nextMatchId) - 1;

        console.log('[MATCHES-COUNT] nextMatchId:', nextMatchId.toString());
        console.log('[MATCHES-COUNT] matches created:', matchesCreated);

        return NextResponse.json({
            count: matchesCreated,
            nextMatchId: nextMatchId.toString()
        });
    } catch (error) {
        console.error('[MATCHES-COUNT] Error fetching match count:', error);
        return NextResponse.json(
            { error: 'Failed to fetch match count' },
            { status: 500 }
        );
    }
} 