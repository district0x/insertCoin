import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/matches/debug
export async function GET() {
    try {
        console.log('Debug endpoint: Checking database connection...');

        // Test database connection
        const matchCount = await prisma.match.count();
        console.log('Debug endpoint: Total matches in database:', matchCount);

        // Get some sample matches
        const sampleMatches = await prisma.match.findMany({
            take: 5,
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                id: true,
                matchId: true,
                game: true,
                gameCategory: true,
                platform: true,
                status: true,
                createdAt: true
            }
        });

        console.log('Debug endpoint: Sample matches:', sampleMatches);

        // Get matches with game data
        const matchesWithGame = await prisma.match.findMany({
            where: {
                game: {
                    not: null
                }
            },
            select: {
                matchId: true,
                game: true,
                gameCategory: true,
                platform: true
            }
        });

        console.log('Debug endpoint: Matches with game data:', matchesWithGame);

        return NextResponse.json({
            success: true,
            totalMatches: matchCount,
            sampleMatches,
            matchesWithGame: matchesWithGame.length,
            gameData: matchesWithGame
        });

    } catch (error) {
        console.error('Debug endpoint error:', error);
        return NextResponse.json(
            { error: 'Database connection failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 