import { NextResponse } from 'next/server';
import { MatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// POST /api/matches/complete
export async function POST(request: Request) {
  try {
    const { matchId, winnerAddress } = await request.json();

    if (!matchId || !winnerAddress) {
      return NextResponse.json(
        { error: 'Match ID and winner address are required' },
        { status: 400 }
      );
    }

    console.log(`[API] Processing match completion for ID ${matchId} with winner ${winnerAddress}`);

    // Get match by ID
    const match = await prisma.match.findUnique({
      where: { matchId: Number(matchId) },
      include: {
        participants: true
      }
    });

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

    // Update the match status and set the winner
    const updatedMatch = await prisma.match.update({
      where: { matchId: Number(matchId) },
      data: {
        status: MatchStatus.COMPLETED,
        winnerAddress: winnerAddress,
        // If we found the winner's user record, set the winner ID
        ...(winnerUser && { winnerId: winnerUser.id })
      },
      include: {
        creator: true,
        participants: true
      }
    });

    // Update players' stats
    if (winnerUser) {
      // Update winner's stats
      await prisma.user.update({
        where: { id: winnerUser.id },
        data: {
          totalWins: { increment: 1 }
        }
      });

      // Update losers' stats 
      for (const participant of match.participants) {
        if (participant.address !== winnerAddress) {
          await prisma.user.update({
            where: { id: participant.id },
            data: {
              totalLosses: { increment: 1 }
            }
          });
        }
      }
    }

    console.log(`[API] Match ${matchId} completed successfully`);
    return NextResponse.json({
      success: true,
      match: updatedMatch
    });
  } catch (error) {
    console.error('[API] Error completing match:', error);
    return NextResponse.json(
      { 
        error: 'Failed to complete match',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 