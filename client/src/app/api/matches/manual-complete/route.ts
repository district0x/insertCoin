import { NextResponse } from 'next/server';
import { MatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

// POST /api/matches/manual-complete
export async function POST(request: Request) {
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }
    try {
        const { matchId, winnerAddress, reason } = await request.json();
        console.log(`[API] Manual match completion called with:`, { matchId, winnerAddress, reason });

        if (!matchId || !winnerAddress) {
            return NextResponse.json(
                { error: 'Match ID and winner address are required' },
                { status: 400 }
            );
        }

        // Get match by matchId using findFirst
        const match = await prisma.match.findFirst({
            where: { matchId: Number(matchId) }
        });

        console.log(`[API] Fetched match:`, match);

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Find both winner and loser user records
        const winnerUser = await prisma.user.findFirst({
            where: { address: winnerAddress }
        });

        // Identify the loser (the other player in the match)
        let loserUser = null;
        if (match.creatorAddress && match.creatorAddress !== winnerAddress) {
            loserUser = await prisma.user.findFirst({
                where: { address: match.creatorAddress }
            });
        } else if (match.player2Address && match.player2Address !== winnerAddress) {
            loserUser = await prisma.user.findFirst({
                where: { address: match.player2Address }
            });
        }

        console.log(`[API] Winner user:`, winnerUser);
        console.log(`[API] Loser user:`, loserUser);

        // Calculate earnings based on match type and token
        const isERC20 = (match as any).tokenName === 'MATCH';

        // Use database totalPrize if available, otherwise calculate from stake
        let totalPrize = match.totalPrize || 0;
        if (totalPrize === 0) {
            const singlePlayerStake = match.stake || 0;
            totalPrize = singlePlayerStake * 2;
        }

        const winnerEarnings = totalPrize * 0.8; // 80% to winner

        console.log(`[API] Manual completion payout calculation:`, {
            singlePlayerStake: match.stake,
            matchTotalPrize: match.totalPrize,
            calculatedTotalPrize: totalPrize,
            winnerEarnings,
            isERC20
        });

        // Update the match status and set the winner using the match's id
        const updatedMatch = await prisma.match.update({
            where: { id: match.id },
            data: {
                status: MatchStatus.COMPLETED,
                winnerAddress: winnerAddress,
                totalPrize: totalPrize, // FIXED: Update database with correct total prize pool
                ...(winnerUser && { winnerId: winnerUser.id })
            }
        });

        console.log(`[API] Updated match:`, updatedMatch);

        // Update winner's stats if we found the user
        if (winnerUser) {
            await prisma.user.update({
                where: { id: winnerUser.id },
                data: {
                    totalMatches: { increment: 1 },
                    totalWins: { increment: 1 },
                    ...(isERC20
                        ? { matchTokensEarned: { increment: winnerEarnings } }
                        : { ethEarned: { increment: winnerEarnings } }
                    )
                }
            });

            console.log(`[API] Updated winner stats for user:`, winnerUser.id);
            console.log(`[API] Winner earnings:`, winnerEarnings, isERC20 ? 'MATCH' : 'ETH');
        }

        // Update loser's stats if we found the user
        if (loserUser) {
            await prisma.user.update({
                where: { id: loserUser.id },
                data: {
                    totalMatches: { increment: 1 },
                    totalLosses: { increment: 1 }
                }
            });

            console.log(`[API] Updated loser stats for user:`, loserUser.id);
        }

        console.log(`[API] Manual match ${matchId} completed successfully`);
        console.log(`[API] Manual completion reason:`, reason);

        return NextResponse.json({
            success: true,
            match: updatedMatch,
            manualCompletion: true,
            reason,
            statistics: {
                winner: winnerUser ? {
                    id: winnerUser.id,
                    address: winnerUser.address,
                    totalMatches: winnerUser.totalMatches + 1,
                    totalWins: winnerUser.totalWins + 1,
                    earnings: winnerEarnings,
                    tokenType: isERC20 ? 'MATCH' : 'ETH'
                } : null,
                loser: loserUser ? {
                    id: loserUser.id,
                    address: loserUser.address,
                    totalMatches: loserUser.totalMatches + 1,
                    totalLosses: loserUser.totalLosses + 1
                } : null
            }
        });

    } catch (error) {
        console.error('[API] Error manually completing match:', error);
        console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

        return NextResponse.json(
            {
                error: 'Failed to manually complete match',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 