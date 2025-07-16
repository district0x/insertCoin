import { NextResponse } from 'next/server';
import { syncTournamentWithDb } from '@/lib/services/tournament';
import type { TournamentStatus } from '../../../../types/tournament';

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { tournamentId, status, entryFee, tokenAddress, totalPrize, maxParticipants } = data;

        // Validate the required fields
        if (!tournamentId || !status || entryFee === undefined || maxParticipants === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Sync tournament with database
        const result = await syncTournamentWithDb({
            tournamentId,
            status: status as TournamentStatus,
            entryFee,
            tokenAddress,
            totalPrize,
            maxParticipants
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to sync tournament with database' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, tournament: result.tournament });
    } catch (error) {
        console.error('Error in tournament sync API:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
} 