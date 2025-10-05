import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

// GET /api/matches/[id]/winner
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }
    console.log('[API-WINNER] Route called with params type:', typeof params);
    console.log('[API-WINNER] Params is Promise:', params instanceof Promise);

    try {
        console.log('[API-WINNER] Awaiting params...');
        const resolvedParams = await params;
        console.log('[API-WINNER] Resolved params:', resolvedParams);

        const matchId = parseInt(resolvedParams.id);
        console.log('[API-WINNER] Parsed matchId:', matchId, 'Type:', typeof matchId);

        if (isNaN(matchId)) {
            console.log('[API-WINNER] Invalid matchId, returning 400');
            return NextResponse.json(
                { error: 'Invalid match ID' },
                { status: 400 }
            );
        }

        console.log('[API-WINNER] Querying database for matchId:', matchId);
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
        console.log('[API-WINNER] Database result:', match);

        if (!match) {
            console.log('[API-WINNER] Match not found, returning 404');
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Only return winner info if match is completed
        if (match.status !== 'COMPLETED') {
            console.log('[API-WINNER] Match not completed, returning empty winner info');
            return NextResponse.json({
                winnerAddress: null,
                winnerAmount: null,
                poolAmount: null
            });
        }

        // CRITICAL: Calculate payouts correctly - only apply 80/15/5 split to player stakes, NOT donations
        // For now, we'll use the totalPrize but note that this should be updated when we have separate fields
        const totalPrizePool = match.totalPrize || 0;

        // Since we don't have separate player stakes vs donations in this API route,
        // we'll use the old calculation for now, but this should be updated
        // TODO: Update database schema to separate player stakes from donations
        const winnerAmount = (totalPrizePool * 0.8).toFixed(6); // 80% of total prize pool
        const platformFee = (totalPrizePool * 0.15).toFixed(6); // 15% for platform
        const multisigFee = (totalPrizePool * 0.05).toFixed(6); // 5% for multisig

        console.log('[API-WINNER] Winner calculation for match', matchId, ':', {
            singlePlayerStake: match.stake,
            matchTotalPrize: match.totalPrize,
            calculatedTotalPrize: totalPrizePool,
            winnerAmount,
            platformFee,
            multisigFee,
            tokenName: (match as any).tokenName
        });

        console.log('[API-WINNER] Returning winner info');
        return NextResponse.json({
            winnerAddress: match.winnerAddress,
            winnerAmount: winnerAmount,
            platformFee: platformFee,
            multisigFee: multisigFee
        });

    } catch (error) {
        // Safe error logging
        const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
        console.error('[API-WINNER] Error fetching winner info:', errorMessage);

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 