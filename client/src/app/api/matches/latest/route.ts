import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        // Fetch only the latest 15 COMPLETED matches from the database
        const matches = await prisma.match.findMany({
            where: {
                status: 'COMPLETED' // Only show completed matches
            },
            take: 15,
            orderBy: {
                id: 'desc' // Newest first
            },
            select: {
                id: true,
                matchId: true,
                creatorAddress: true,
                player2Address: true,
                stake: true,
                tokenName: true,
                winnerAddress: true,
                status: true,
                createdAt: true,
                game: true,
                platform: true,
                creatorName: true,
                player2Name: true,
            }
        });

        // Convert and format the data
        const serializedMatches = matches.map(match => {
            // Determine if there are 2 players
            const hasPlayer2 = match.player2Address &&
                match.player2Address !== '' &&
                match.player2Address !== '0x0000000000000000000000000000000000000000';

            // Calculate total amount (stake * number of players)
            const playerCount = hasPlayer2 ? 2 : 1;
            const totalAmount = (match.stake || 0) * playerCount;

            // Create display status for UI
            let displayStatus: string = match.status;
            if (match.status === 'OPEN' && hasPlayer2) {
                displayStatus = 'IN_PROGRESS';
            } else if (match.status === 'OPEN' && !hasPlayer2) {
                displayStatus = 'WAITING';
            }

            return {
                id: match.id,
                matchId: match.matchId || 0,
                creatorAddress: match.creatorAddress || '',
                player2Address: match.player2Address || null,
                totalAmount: totalAmount,
                isERC20: match.tokenName === 'MATCH',
                winner: match.winnerAddress || null,
                status: match.status, // Keep original status for database consistency
                displayStatus: displayStatus, // Add display status for UI
                createdAt: match.createdAt.toISOString(),
                game: match.game || 'N/A',
                platform: match.platform || 'N/A',
                creatorName: match.creatorName || 'Unknown',
                player2Name: match.player2Name || null,
                playerCount: playerCount,
                stake: match.stake || 0,
            };
        });

        return NextResponse.json({
            success: true,
            matches: serializedMatches,
            count: serializedMatches.length
        });

    } catch (error) {
        console.error('Error fetching latest matches:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch latest matches',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
} 