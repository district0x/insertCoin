import { NextResponse } from 'next/server';
import { MatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// POST /api/matches/complete
export async function POST(request: Request) {
  try {
    const { matchId, winnerAddress } = await request.json();
    console.log(`[API] /api/matches/complete called with:`, { matchId, winnerAddress });

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

    // Find the winner's user record
    const winnerUser = await prisma.user.findFirst({
      where: { address: winnerAddress }
    });

    console.log(`[API] Winner user:`, winnerUser);

    // Update the match status and set the winner using the match's id
    const updatedMatch = await prisma.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.COMPLETED,
        winnerAddress: winnerAddress,
        ...(winnerUser && { winnerId: winnerUser.id })
      }
    });

    console.log(`[API] Updated match:`, updatedMatch);

    // Update winner's stats if we found the user
    if (winnerUser) {
      await prisma.user.update({
        where: { id: winnerUser.id },
        data: { totalWins: { increment: 1 } }
      });

      console.log(`[API] Updated winner stats for user:`, winnerUser.id);
    }

    console.log(`[API] Match ${matchId} completed successfully`);

    return NextResponse.json({
      success: true,
      match: updatedMatch
    });

  } catch (error) {
    console.error('[API] Error completing match:', error);
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Failed to complete match',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 