import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

// GET /api/matches/[id]/status
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }
    console.log('[API-STATUS] Route called with params type:', typeof params);
    console.log('[API-STATUS] Params is Promise:', params instanceof Promise);

    try {
        console.log('[API-STATUS] Awaiting params...');
        const resolvedParams = await params;
        console.log('[API-STATUS] Resolved params:', resolvedParams);

        const matchId = parseInt(resolvedParams.id);
        console.log('[API-STATUS] Parsed matchId:', matchId, 'Type:', typeof matchId);

        if (isNaN(matchId)) {
            console.log('[API-STATUS] Invalid matchId, returning 400');
            return NextResponse.json(
                { error: 'Invalid match ID' },
                { status: 400 }
            );
        }

        console.log('[API-STATUS] Querying database for matchId:', matchId);
        // Get match status from database
        const match = await prisma.match.findFirst({
            where: { matchId },
            select: { status: true }
        });
        console.log('[API-STATUS] Database result:', match);

        if (!match) {
            console.log('[API-STATUS] Match not found, returning 404');
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        console.log('[API-STATUS] Returning success with status:', match.status);
        return NextResponse.json({
            status: match.status
        });

    } catch (error) {
        // Safe error logging
        const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
        console.error('[API-STATUS] Error fetching match status:', errorMessage);

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 