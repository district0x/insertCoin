import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/matches/[id]/status
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

        // Get match status from database
        const match = await prisma.match.findFirst({
            where: { matchId },
            select: { status: true }
        });

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            status: match.status
        });

    } catch (error) {
        console.error('[API] Error fetching match status:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 