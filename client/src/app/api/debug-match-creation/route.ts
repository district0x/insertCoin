import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from '@/lib/config/chains';
import { ONEVONE_ABI } from '@/lib/contracts/abis/ABI';
import { prisma } from '@/lib/prisma';

// GET /api/debug-match-creation
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const matchId = searchParams.get('matchId');

        console.log(`[API] Debugging match creation for match: ${matchId}`);

        // Create public client
        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
        });

        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        // Get contract's next match ID
        const nextMatchId = await publicClient.readContract({
            address: contractAddress,
            abi: ONEVONE_ABI,
            functionName: "nextMatchId",
        });

        // Get match details from blockchain if matchId is provided
        let blockchainMatch = null;
        if (matchId) {
            try {
                const match = await publicClient.readContract({
                    address: contractAddress,
                    abi: ONEVONE_ABI,
                    functionName: "matches",
                    args: [BigInt(matchId)]
                });

                blockchainMatch = {
                    player1: match[0],
                    player2: match[1],
                    player1Amount: match[2],
                    player2Amount: match[3],
                    totalAmount: match[4],
                    donatedAmount: match[5],
                    isOpen: match[6],
                    isClosed: match[7],
                    isERC20: match[8],
                    token: match[9]
                };
            } catch (error) {
                console.error(`[API] Error fetching match ${matchId} from blockchain:`, error);
            }
        }

        // Get database matches
        const dbMatches = await prisma.match.findMany({
            orderBy: { matchId: 'desc' },
            take: 10,
            select: {
                id: true,
                matchId: true,
                matchType: true,
                status: true,
                stake: true,
                totalPrize: true,
                tokenName: true,
                creatorAddress: true,
                player2Address: true,
                winnerAddress: true,
                createdAt: true
            }
        });

        // Check if specific match exists in database
        let dbMatch = null;
        if (matchId) {
            dbMatch = await prisma.match.findFirst({
                where: { matchId: Number(matchId) },
                select: {
                    id: true,
                    matchId: true,
                    matchType: true,
                    status: true,
                    stake: true,
                    totalPrize: true,
                    tokenName: true,
                    creatorAddress: true,
                    player2Address: true,
                    winnerAddress: true,
                    createdAt: true
                }
            });
        }

        console.log(`[API] Match creation analysis:`, {
            contractNextMatchId: nextMatchId.toString(),
            blockchainMatch,
            dbMatch,
            recentDbMatches: dbMatches.length
        });

        return NextResponse.json({
            success: true,
            contract: {
                address: contractAddress,
                nextMatchId: nextMatchId.toString()
            },
            blockchain: {
                match: blockchainMatch
            },
            database: {
                match: dbMatch,
                recentMatches: dbMatches,
                totalMatches: dbMatches.length
            },
            analysis: {
                matchExistsInBlockchain: !!blockchainMatch,
                matchExistsInDatabase: !!dbMatch,
                blockchainMatchId: matchId,
                databaseMatchId: dbMatch?.matchId,
                syncStatus: dbMatch ? 'SYNCED' : 'MISSING_IN_DB'
            }
        });

    } catch (error) {
        console.error('[API] Error debugging match creation:', error);
        return NextResponse.json(
            {
                error: 'Failed to debug match creation',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 