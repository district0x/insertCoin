import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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
                totalWins: true,
                totalMatches: true,
            },
            orderBy: {
                totalWins: 'desc'
            },
            take: 20 // Limit to top 20 players
        });

        return NextResponse.json(players);
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