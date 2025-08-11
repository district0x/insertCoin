import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from '@/lib/middleware/rate-limit';

export async function GET(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        // Fetch all users with their stats, ordered by total wins descending
        const players = await prisma.user.findMany({
            where: {
                address: {
                    not: null
                },
                totalWins: {
                    gt: 0
                }
            },
            select: {
                address: true,
                username: true,
                totalWins: true,
                totalMatches: true,
                matchTokensEarned: true,
            },
            orderBy: {
                totalWins: 'desc'
            },
            take: 20 // Limit to top 20 players
        });

        // Format MATCH tokens as whole numbers
        const playersWithStats = players.map(player => {
            const matchTokensWhole = Math.floor(player.matchTokensEarned);

            return {
                address: player.address,
                username: player.username,
                totalWins: player.totalWins,
                totalMatches: player.totalMatches,
                matchTokensEarned: matchTokensWhole,
            };
        });

        return NextResponse.json(playersWithStats);
    } catch (error) {
        // Handle error properly
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error fetching player stats:', errorMessage);

        return NextResponse.json(
            { error: 'Failed to fetch player statistics' },
            { status: 500 }
        );
    }
} 