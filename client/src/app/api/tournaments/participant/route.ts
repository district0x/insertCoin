import { NextResponse, NextRequest } from 'next/server';
import { addTournamentParticipant } from '@/lib/services/tournament';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

export async function POST(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const data = await request.json();
        const { tournamentId, walletAddress } = data;

        // Validate the required fields
        if (!tournamentId || !walletAddress) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Add participant to tournament
        const result = await addTournamentParticipant({
            tournamentId,
            walletAddress
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to add participant to tournament' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, tournament: result.tournament });
    } catch (error) {
        console.error('Error in tournament participant API:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
} 