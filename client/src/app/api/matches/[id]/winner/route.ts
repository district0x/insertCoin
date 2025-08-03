import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/matches/[id]/winner
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const matchId = parseInt(params.id);

        if (isNaN(matchId)) {
            return NextResponse.json(
                { error: 'Invalid match ID' },
                { status: 400 }
            );
        }

        // Get match with winner information from database
        const match = await prisma.match.findFirst({
            where: { matchId },
            select: {
                winnerAddress: true,
                status: true,
                stake: true,
                totalPrize: true
            }
        });

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Only return winner info if match is completed
        if (match.status !== 'COMPLETED') {
            return NextResponse.json({
                winnerAddress: null,
                winnerAmount: null,
                poolAmount: null
            });
        }

        // FIXED: Calculate winner amount using total prize pool (stake * 2)
        const singlePlayerStake = match.stake || 0;
        const totalPrizePool = singlePlayerStake * 2; // Always calculate correctly: stake * 2
        const winnerAmount = (totalPrizePool * 0.8).toFixed(6); // 80% of total prize pool
        const poolAmount = (totalPrizePool * 0.1).toFixed(6); // 10% for multisig

        console.log(`[API] Winner calculation for match ${matchId}:`, {
            singlePlayerStake,
            matchTotalPrize: match.totalPrize,
            calculatedTotalPrize: totalPrizePool,
            winnerAmount,
            poolAmount,
            tokenName: (match as any).tokenName
        });

        return NextResponse.json({
            winnerAddress: match.winnerAddress,
            winnerAmount: winnerAmount,
            poolAmount: poolAmount
        });

    } catch (error) {
        console.error('[API] Error fetching winner info:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 