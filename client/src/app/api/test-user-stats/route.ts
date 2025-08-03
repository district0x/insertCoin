import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/test-user-stats
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json(
                { error: 'Address parameter is required' },
                { status: 400 }
            );
        }

        console.log(`[API] Testing user stats for address: ${address}`);

        // Get user by address
        const user = await prisma.user.findFirst({
            where: { address }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get user's match history
        const matches = await prisma.match.findMany({
            where: {
                OR: [
                    { creatorAddress: address },
                    { player2Address: address },
                    { winnerAddress: address }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        console.log(`[API] User stats:`, {
            id: user.id,
            address: user.address,
            totalMatches: user.totalMatches,
            totalWins: user.totalWins,
            totalLosses: user.totalLosses,
            matchTokensEarned: user.matchTokensEarned,
            ethEarned: user.ethEarned,
            matchCount: matches.length
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                address: user.address,
                totalMatches: user.totalMatches,
                totalWins: user.totalWins,
                totalLosses: user.totalLosses,
                matchTokensEarned: user.matchTokensEarned,
                ethEarned: user.ethEarned,
                winRate: user.totalMatches > 0 ? (user.totalWins / user.totalMatches) * 100 : 0
            },
            recentMatches: matches.map(match => ({
                id: match.id,
                matchId: match.matchId,
                status: match.status,
                stake: match.stake,
                totalPrize: match.totalPrize,
                tokenName: match.tokenName,
                winnerAddress: match.winnerAddress,
                isWinner: match.winnerAddress === address,
                createdAt: match.createdAt
            }))
        });

    } catch (error) {
        console.error('[API] Error testing user stats:', error);
        return NextResponse.json(
            {
                error: 'Failed to test user stats',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 