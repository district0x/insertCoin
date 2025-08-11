import { NextResponse, NextRequest } from 'next/server';
import { updateTournamentStatus } from '@/lib/services/tournament';
import { TournamentStatus as PrismaTournamentStatus } from '@prisma/client';
import { applyRateLimit } from '@/lib/middleware/rate-limit';
import { z } from 'zod';

const statusSchema = z.object({
    tournamentId: z.union([z.string(), z.number()]),
    status: z.string()
});

export async function PUT(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const data = await request.json();
        const parsed = statusSchema.safeParse(data);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }
        const { tournamentId, status } = parsed.data as any;

        // Convert string status to Prisma enum value
        let prismaStatus: PrismaTournamentStatus;

        // Map app status to Prisma status
        switch (status) {
            case 'CREATED':
                prismaStatus = PrismaTournamentStatus.CREATED;
                break;
            case 'FILLING':
                prismaStatus = PrismaTournamentStatus.FILLING;
                break;
            case 'FILLED':
                prismaStatus = PrismaTournamentStatus.IN_PROGRESS; // Map FILLED to IN_PROGRESS for Prisma
                break;
            case 'IN_PROGRESS':
                prismaStatus = PrismaTournamentStatus.IN_PROGRESS;
                break;
            case 'COMPLETED':
                prismaStatus = PrismaTournamentStatus.COMPLETED;
                break;
            case 'CANCELLED':
                prismaStatus = PrismaTournamentStatus.CANCELLED;
                break;
            default:
                return NextResponse.json(
                    { error: 'Invalid tournament status' },
                    { status: 400 }
                );
        }

        // Update tournament status
        const result = await updateTournamentStatus({
            tournamentId,
            status: prismaStatus
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to update tournament status' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, tournament: result.tournament });
    } catch (error) {
        console.error('Error in tournament status API:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
} 