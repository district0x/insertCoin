import { NextResponse } from 'next/server';
import { updateTournamentPrize } from '@/lib/services/tournament';

export async function PUT(request: Request) {
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