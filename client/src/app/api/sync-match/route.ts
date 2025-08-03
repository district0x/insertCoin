import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from '@/lib/config/chains';
import { ONEVONE_ABI } from '@/lib/contracts/abis/ABI';
import { prisma } from '@/lib/prisma';
import { MatchStatus, MatchType } from '@prisma/client';

// POST /api/sync-match
export async function POST(request: Request) {
    try {
        const { matchId, walletAddress } = await request.json();
        console.log(`[API] Syncing match ${matchId} for wallet ${walletAddress}`);

        if (!matchId || !walletAddress) {
            return NextResponse.json(
                { error: 'Match ID and wallet address are required' },
                { status: 400 }
            );
        }

        // Create public client
        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
        });

        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        // Get match details from blockchain
        const blockchainMatch = await publicClient.readContract({
            address: contractAddress,
            abi: ONEVONE_ABI,
            functionName: "matches",
            args: [BigInt(matchId)]
        });

        console.log(`[API] Blockchain match data:`, blockchainMatch);

        // Check if match already exists in database
        const existingMatch = await prisma.match.findFirst({
            where: { matchId: Number(matchId) }
        });

        if (existingMatch) {
            console.log(`[API] Match ${matchId} already exists in database`);
            return NextResponse.json({
                success: true,
                message: 'Match already exists in database',
                match: existingMatch
            });
        }

        // Create or get user
        const user = await prisma.user.upsert({
            where: { address: walletAddress },
            update: {},
            create: {
                address: walletAddress,
            },
        });

        console.log(`[API] User upserted:`, user.id);

        // Determine match type and token info
        const isERC20 = blockchainMatch[8]; // isERC20 field
        const tokenAddress = blockchainMatch[9]; // token address
        const tokenName = isERC20 ? 'MATCH' : 'ETH';
        const stake = Number(blockchainMatch[2]); // player1Amount

        // Create match in database
        const match = await prisma.match.create({
            data: {
                matchId: Number(matchId),
                matchType: MatchType.ONE_V_ONE, // Default to 1v1, adjust if needed
                status: MatchStatus.OPEN,
                creatorId: user.id,
                creatorAddress: walletAddress,
                stake: stake,
                totalPrize: stake,
                tokenName: tokenName,
            },
        });

        console.log(`[API] Match created in database:`, match);

        return NextResponse.json({
            success: true,
            message: 'Match synced successfully',
            match: {
                id: match.id,
                matchId: match.matchId,
                matchType: match.matchType,
                status: match.status,
                stake: match.stake,
                totalPrize: match.totalPrize,
                tokenName: match.tokenName,
                creatorAddress: match.creatorAddress
            },
            blockchain: {
                player1: blockchainMatch[0],
                player2: blockchainMatch[1],
                player1Amount: blockchainMatch[2].toString(),
                player2Amount: blockchainMatch[3].toString(),
                totalAmount: blockchainMatch[4].toString(),
                donatedAmount: blockchainMatch[5].toString(),
                isOpen: blockchainMatch[6],
                isClosed: blockchainMatch[7],
                isERC20: blockchainMatch[8],
                token: blockchainMatch[9]
            }
        });

    } catch (error) {
        console.error('[API] Error syncing match:', error);
        return NextResponse.json(
            {
                error: 'Failed to sync match',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 