import { NextResponse } from 'next/server';
import { MatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';
import { z } from 'zod';

const completeSchema = z.object({
  matchId: z.union([z.string(), z.number()]),
  winnerAddress: z.string()
});

// POST /api/matches/complete
export async function POST(request: Request) {
  const rateLimitResponse = applyRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  try {
    const body = await request.json();
    const valid = completeSchema.safeParse(body);
    if (!valid.success) {
      return NextResponse.json(
        { error: 'Match ID and winner address are required' },
        { status: 400 }
      );
    }
    const { matchId, winnerAddress } = valid.data as any;
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

    // Get the actual total prize pool from smart contract (includes donations)
    // We need to fetch this from the blockchain since donations are tracked on-chain
    const { createPublicClient, http } = await import('viem');
    const { baseSepolia } = await import('@/lib/config/chains');
    const { ONEVONE_ABI } = await import('@/lib/contracts/abis/ABI');
    const { formatEther } = await import('viem');

    let totalPrize = 0;

    try {
      // Create public client
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
      });

      // Get contract address
      const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xC24Cea38b8D6e7303DFfA7d5bc309FE5f8FCaD08";

      // Fetch match data from smart contract
      const matchData = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ONEVONE_ABI,
        functionName: 'matches',
        args: [BigInt(matchId)]
      }) as readonly [
        `0x${string}`, // player1
        `0x${string}`, // player2
        bigint, // player1Amount
        bigint, // player2Amount
        bigint, // totalAmount
        bigint, // donatedAmount
        boolean, // isOpen
        boolean, // isClosed
        boolean, // isERC20
        `0x${string}` // token
      ];

      // Calculate total prize pool: totalAmount + donatedAmount
      const totalAmount = matchData[4]; // totalAmount from contract
      const donatedAmount = matchData[5]; // donatedAmount from contract
      totalPrize = Number(formatEther(totalAmount + donatedAmount));

      console.log(`[API] Smart contract match data:`, {
        matchId,
        totalAmount: formatEther(totalAmount),
        donatedAmount: formatEther(donatedAmount),
        totalPrize,
        isERC20
      });

    } catch (error) {
      console.error('[API] Error fetching smart contract data:', error);
      // Fallback to database calculation if smart contract call fails
      const singlePlayerStake = match.stake || 0;
      totalPrize = singlePlayerStake * 2;
      console.log(`[API] Using fallback calculation:`, { totalPrize });
    }

    const winnerEarnings = totalPrize * 0.8; // 80% to winner
    const platformFee = totalPrize * 0.15; // 15% to platform
    const multisigFee = totalPrize * 0.05; // 5% to multisig

    console.log(`[API] Payout breakdown:`, {
      totalPrize,
      winnerEarnings,
      platformFee,
      multisigFee,
      totalCalculated: winnerEarnings + platformFee + multisigFee,
      breakdown: {
        winnerPercentage: '80%',
        platformPercentage: '10%',
        multisigPercentage: '10%'
      }
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

    // Update player matchup records for 1v1 matches
    if (winnerUser && loserUser && match.matchType === "ONE_V_ONE") {
      try {
        // Get Discord IDs for both players
        const winnerDiscordId = winnerUser.discordId;
        const loserDiscordId = loserUser.discordId;

        if (winnerDiscordId && loserDiscordId) {
          // Import the record tracking function
          const { updatePlayerMatchup } = await import('@/lib/services/user');

          await updatePlayerMatchup(winnerDiscordId, loserDiscordId);
          console.log(`[API] Updated player matchup record: ${winnerDiscordId} vs ${loserDiscordId}`);
        }
      } catch (error) {
        console.error(`[API] Error updating player matchup record:`, error);
        // Don't fail the match completion if record tracking fails
      }
    }

    // Update team statistics for 2v2 and 5v5 matches
    if (match.matchType === "TWO_V_TWO" || match.matchType === "FIVE_V_FIVE") {
      try {
        // Get all participants for team stats
        const participants = await prisma.user.findMany({
          where: {
            "OR": [
              { address: winnerAddress },
              { address: match.creatorAddress },
              { address: match.player2Address }
            ].filter(Boolean)
          }
        });

        const participantIds = participants
          .map(p => p.discordId)
          .filter(id => id) as string[];

        if (participantIds.length > 0) {
          // Import the team stats function
          const { updateTeamStats } = await import('@/lib/services/user');

          const matchType = match.matchType === "TWO_V_TWO" ? "2v2" : "5v5";

          // Update stats for all participants
          await updateTeamStats(participantIds, matchType, true); // All participants get a win/loss record
          console.log(`[API] Updated team stats for ${participantIds.length} participants in ${matchType} match`);
        }
      } catch (error) {
        console.error(`[API] Error updating team stats:`, error);
        // Don't fail the match completion if team stats tracking fails
      }
    }

    console.log(`[API] Match ${matchId} completed successfully`);
    console.log(`[API] Statistics updated:`, {
      winner: winnerUser ? {
        id: winnerUser.id,
        address: winnerUser.address,
        totalMatches: winnerUser.totalMatches + 1,
        totalWins: winnerUser.totalWins + 1,
        earnings: winnerEarnings
      } : null,
      loser: loserUser ? {
        id: loserUser.id,
        address: loserUser.address,
        totalMatches: loserUser.totalMatches + 1,
        totalLosses: loserUser.totalLosses + 1
      } : null,
      matchType: isERC20 ? 'MATCH' : 'ETH',
      totalPrize,
      winnerEarnings,
      platformFee,
      multisigFee
    });

    return NextResponse.json({
      success: true,
      match: updatedMatch,
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