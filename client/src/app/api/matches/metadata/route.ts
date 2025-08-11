import { NextResponse, NextRequest } from 'next/server';
import { prisma, resetPrismaConnection } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

// GET /api/matches/metadata?matchIds=1,2,3
export async function GET(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }
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
                    creatorAddress: true,
                    creatorName: true, // ADD: Direct creator username field
                    player2DiscordId: true,
                    player2Address: true,
                    player2Name: true, // ADD: Direct player2 username field
                    stake: true,
                    totalPrize: true,
                    matchAmountUsd: true, // ADD: Original USD amount
                    tokenName: true,
                    game: true, // ADD: Game name
                    gameCategory: true, // ADD: Game category
                    createdAt: true,
                    updatedAt: true,
                    creator: {
                        select: {
                            username: true
                        }
                    }
                }
            });

            // Convert to a map for easy lookup
            const metadataMap = matches.reduce((acc, match) => {
                if (match.matchId) {
                    acc[match.matchId] = {
                        matchType: match.matchType,
                        status: match.status,
                        creatorDiscordId: match.creatorDiscordId,
                        creatorAddress: match.creatorAddress,
                        creatorUsername: (match as any).creatorName || match.creator?.username, // ADD: Use direct field first, fallback to User table
                        opponentDiscordId: match.player2DiscordId, // Map to expected field name
                        player2Address: match.player2Address,
                        player2Username: (match as any).player2Name, // ADD: Use direct player2 username field
                        stake: match.stake,
                        totalPrize: match.totalPrize,
                        matchAmountUsd: (match as any).matchAmountUsd, // ADD: Original USD amount
                        tokenName: match.tokenName,
                        game: (match as any).game, // ADD: Game name
                        gameCategory: (match as any).gameCategory, // ADD: Game category
                        createdAt: match.createdAt,
                        updatedAt: match.updatedAt
                    };
                }
                return acc;
            }, {} as Record<number, any>);

            // Note: player2 usernames are now stored directly in the match table
            // The above complex lookup is no longer needed since we have direct fields
            // Keeping this as fallback for any matches that don't have the direct field yet
            const player2Addresses = matches
                .filter(match => match.player2Address && !(match as any).player2Name)
                .map(match => match.player2Address!);

            if (player2Addresses.length > 0) {
                const player2Users = await prisma.user.findMany({
                    where: {
                        address: {
                            in: player2Addresses
                        }
                    },
                    select: {
                        address: true,
                        username: true
                    }
                });

                // Create a map of address to username
                const player2UsernameMap = player2Users.reduce((acc, user) => {
                    if (user.address && user.username) {
                        acc[user.address] = user.username;
                    }
                    return acc;
                }, {} as Record<string, string>);

                // Add player2 usernames to metadata (fallback only)
                Object.keys(metadataMap).forEach(matchIdStr => {
                    const matchId = parseInt(matchIdStr);
                    const match = metadataMap[matchId];
                    if (match && match.player2Address && player2UsernameMap[match.player2Address] && !match.player2Username) {
                        match.player2Username = player2UsernameMap[match.player2Address];
                    }
                });
            }

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