import { NextResponse, NextRequest } from 'next/server';
import { syncTournamentWithDb } from '@/lib/services/tournament';
import type { TournamentStatus } from '../../../../types/tournament';
import { applyRateLimit } from '@/lib/middleware/rate-limit';
import { z } from 'zod';

const syncSchema = z.object({
    tournamentId: z.union([z.string(), z.number()]),
    status: z.string(),
    entryFee: z.number(),
    tokenAddress: z.string().optional(),
    totalPrize: z.number().optional(),
    maxParticipants: z.number(),
});

export async function POST(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const data = await request.json();
        const parsed = syncSchema.safeParse(data);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Missing or invalid required fields' },
                { status: 400 }
            );
        }
        const { tournamentId, status, entryFee, tokenAddress, totalPrize, maxParticipants } = parsed.data as any;

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