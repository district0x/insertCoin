import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/matches/metadata?matchIds=1,2,3
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const matchIdsParam = searchParams.get('matchIds');

        if (!matchIdsParam) {
            return NextResponse.json(
                { error: 'matchIds parameter is required' },
                { status: 400 }
            );
        }

        // Parse match IDs from comma-separated string
        const matchIds = matchIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

        if (matchIds.length === 0) {
            return NextResponse.json(
                { error: 'No valid match IDs provided' },
                { status: 400 }
            );
        }

        // Fetch match metadata from database - look for exact matchId matches
        const matches = await prisma.match.findMany({
            where: {
                matchId: {
                    in: matchIds
                }
            },
            select: {
                matchId: true,
                game: true,
                gameCategory: true,
                platform: true,
                status: true,
                creatorDiscordId: true,
                opponentDiscordId: true,
                winnerId: true
            }
        });

        // Convert to a map for easy lookup
        const metadataMap = matches.reduce((acc, match) => {
            if (match.matchId) {
                acc[match.matchId] = {
                    game: match.game || null,
                    gameCategory: match.gameCategory || null,
                    platform: match.platform || null,
                    status: match.status,
                    creatorDiscordId: match.creatorDiscordId,
                    opponentDiscordId: match.opponentDiscordId,
                    winnerId: match.winnerId
                };
            }
            return acc;
        }, {} as Record<number, any>);

        return NextResponse.json({
            success: true,
            metadata: metadataMap
        });

    } catch (error) {
        console.error('Error fetching match metadata:', error);
        return NextResponse.json(
            { error: 'Failed to fetch match metadata' },
            { status: 500 }
        );
    }
} 