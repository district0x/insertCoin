import { NextResponse } from 'next/server';
import { prisma, resetPrismaConnection } from '@/lib/prisma';

// GET /api/matches/metadata?matchIds=1,2,3
export async function GET(request: Request) {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
                    matchType: true,
                    status: true,
                    creatorDiscordId: true,
                    player2DiscordId: true,
                    player2Address: true,
                    stake: true,
                    totalPrize: true,
                    tokenName: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            // Convert to a map for easy lookup
            const metadataMap = matches.reduce((acc, match) => {
                if (match.matchId) {
                    acc[match.matchId] = {
                        matchType: match.matchType,
                        status: match.status,
                        creatorDiscordId: match.creatorDiscordId,
                        player2DiscordId: match.player2DiscordId,
                        player2Address: match.player2Address,
                        stake: match.stake,
                        totalPrize: match.totalPrize,
                        tokenName: match.tokenName,
                        createdAt: match.createdAt,
                        updatedAt: match.updatedAt
                    };
                }
                return acc;
            }, {} as Record<number, any>);

            return NextResponse.json({
                success: true,
                metadata: metadataMap
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
            console.error(`Error fetching match metadata (attempt ${attempt + 1}):`, errorMessage);

            if (errorMessage.includes("prepared statement") && attempt < maxRetries - 1) {
                console.log(`Prepared statement error detected, resetting connection and retrying...`);
                await resetPrismaConnection();
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }

            return NextResponse.json(
                { error: 'Failed to fetch match metadata' },
                { status: 500 }
            );
        }
    }

    return NextResponse.json(
        { error: 'Failed to fetch match metadata after multiple retries' },
        { status: 500 }
    );
} 