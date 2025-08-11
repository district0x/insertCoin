import { NextResponse, NextRequest } from 'next/server';
import { updateTournamentPrize } from '@/lib/services/tournament';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

export async function PUT(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const data = await request.json();
        const { tournamentId, totalPrize } = data;

        // Validate the required fields
        if (!tournamentId || totalPrize === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Update tournament prize
        const result = await updateTournamentPrize({
            tournamentId,
            totalPrize
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to update tournament prize' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, tournament: result.tournament });
    } catch (error) {
        console.error('Error in tournament prize API:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
} 