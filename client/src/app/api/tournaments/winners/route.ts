import { NextResponse } from 'next/server';
import { updateTournamentWinners } from '@/lib/services/tournament';

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { tournamentId, winners } = data;

        // Validate the required fields
        if (!tournamentId || !winners || !Array.isArray(winners)) {
            return NextResponse.json(
                { error: 'Missing or invalid required fields' },
                { status: 400 }
            );
        }

        // Update tournament winners
        const result = await updateTournamentWinners({
            tournamentId,
            winners
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to update tournament winners' },
                { status: 500 }
            );
        }

        // Return the tournament and winner user IDs
        return NextResponse.json({
            success: true,
            tournament: result.tournament,
            winnerUserIds: result.winnerUserIds
        });
    } catch (error) {
        console.error('Error in tournament winners API:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
} 