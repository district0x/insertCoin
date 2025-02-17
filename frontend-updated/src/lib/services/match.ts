"use server";

import { prisma } from "@/lib/prisma";
import { MatchStatus, MatchType } from "@prisma/client";

// Function to create a pending match from Discord bot
export async function createPendingMatch({
  matchId,
  type,
  discordId,
  stake,
}: {
  matchId: string;
  type: MatchType;
  discordId: string;
  stake: number;
}) {
  try {
    const match = await prisma.match.create({
      data: {
        matchId: parseInt(matchId),
        matchType: type,
        status: MatchStatus.PENDING,
        creatorDiscordId: discordId,
        stake,
        totalPrize: stake,
      },
    });
    return match;
  } catch (error) {
    console.error("Error creating pending match:", error);
    throw error;
  }
}

// Function to update match with wallet address and link to Discord ID
export async function updateMatchWithWallet({
  matchId,
  walletAddress,
}: {
  matchId: string;
  walletAddress: string;
}) {
  try {
    console.log(`[DB] Finding match with ID ${matchId}`);
    // Find the match
    const match = await prisma.match.findUnique({
      where: { matchId: parseInt(matchId) },
      include: { creator: true },
    });

    if (!match) {
      console.log(`[DB] Match ${matchId} not found`);
      throw new Error("Match not found");
    }

    console.log(`[DB] Found match: ${JSON.stringify(match)}`);

    // If match was created through Discord
    if (match.creatorDiscordId) {
      console.log(`[DB] Match has Discord ID: ${match.creatorDiscordId}`);
      // Check if user with this wallet already exists
      const existingUser = await prisma.user.findFirst({
        where: { address: walletAddress },
      });

      if (existingUser) {
        console.log(`[DB] Found existing user with wallet ${walletAddress}`);
        // If user exists but doesn't have Discord ID, update it
        if (!existingUser.discordId) {
          console.log(
            `[DB] Updating existing user with Discord ID ${match.creatorDiscordId}`
          );
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { discordId: match.creatorDiscordId },
          });
        } else if (existingUser.discordId !== match.creatorDiscordId) {
          console.log(
            `[DB] Wallet ${walletAddress} already linked to different Discord ID ${existingUser.discordId}`
          );
          throw new Error(
            "Wallet already linked to a different Discord account"
          );
        }
      }

      // Create or update user with both Discord ID and wallet
      console.log(
        `[DB] Upserting user with Discord ID ${match.creatorDiscordId} and wallet ${walletAddress}`
      );
      const user = await prisma.user.upsert({
        where: { discordId: match.creatorDiscordId },
        update: { address: walletAddress },
        create: {
          address: walletAddress,
          discordId: match.creatorDiscordId,
        },
      });

      // Update match with creator and status
      console.log(`[DB] Updating match ${matchId} with creator ID ${user.id}`);
      const updatedMatch = await prisma.match.update({
        where: { id: match.id },
        data: {
          creatorId: user.id,
          status: MatchStatus.OPEN,
        },
        include: {
          creator: true,
        },
      });

      console.log(
        `[DB] Match updated successfully: ${JSON.stringify(updatedMatch)}`
      );
      return updatedMatch;
    }

    // If match wasn't created through Discord, just create/update user with wallet
    console.log(
      `[DB] Regular match - upserting user with wallet ${walletAddress}`
    );
    const user = await prisma.user.upsert({
      where: { address: walletAddress },
      update: {},
      create: {
        address: walletAddress,
      },
    });

    // Update match with creator and status
    console.log(`[DB] Updating match ${matchId} with creator ID ${user.id}`);
    const updatedMatch = await prisma.match.update({
      where: { id: match.id },
      data: {
        creatorId: user.id,
        status: MatchStatus.OPEN,
      },
      include: {
        creator: true,
      },
    });

    console.log(
      `[DB] Match updated successfully: ${JSON.stringify(updatedMatch)}`
    );
    return updatedMatch;
  } catch (error) {
    console.error("[DB] Error updating match with wallet:", error);
    throw error;
  }
}

// Function to get next available match ID
export async function getNextMatchId(): Promise<number> {
  try {
    const lastMatch = await prisma.match.findFirst({
      orderBy: { matchId: "desc" },
    });
    return (lastMatch?.matchId ?? 0) + 1;
  } catch (error) {
    console.error("Error getting next match ID:", error);
    throw error;
  }
}

// Function to find match by Discord ID
export async function findMatchByDiscordId(discordId: string) {
  try {
    return await prisma.match.findFirst({
      where: {
        creatorDiscordId: discordId,
        status: MatchStatus.PENDING,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("Error finding match by Discord ID:", error);
    throw error;
  }
}

// Function to create a regular match in the database
export async function createMatchInDb({
  walletAddress,
  matchType,
  stake,
  matchId,
}: {
  walletAddress: string;
  matchType: MatchType;
  stake: string;
  matchId: number;
}) {
  try {
    console.log(`[DB] Processing match for wallet ${walletAddress}`);

    // Create or get user
    console.log(`[DB] Upserting user with wallet ${walletAddress}`);
    const user = await prisma.user.upsert({
      where: { address: walletAddress },
      update: {},
      create: {
        address: walletAddress,
      },
    });
    console.log(`[DB] User upserted: ${JSON.stringify(user)}`);

    // Check if match already exists (created by Discord bot)
    const existingMatch = await prisma.match.findUnique({
      where: { matchId },
      include: { creator: true },
    });

    if (existingMatch) {
      console.log(`[DB] Updating existing match with ID ${matchId}`);
      const updatedMatch = await prisma.match.update({
        where: { matchId },
        data: {
          matchType,
          status: MatchStatus.OPEN,
          creatorId: user.id,
          stake: parseFloat(stake),
          totalPrize: parseFloat(stake),
        },
        include: {
          creator: true,
        },
      });
      console.log(`[DB] Match updated successfully: ${JSON.stringify(updatedMatch)}`);
      return updatedMatch;
    }

    // If no existing match, create new one
    console.log(`[DB] Creating new match with ID ${matchId}`);
    const match = await prisma.match.create({
      data: {
        matchId,
        matchType,
        status: MatchStatus.OPEN,
        creatorId: user.id,
        stake: parseFloat(stake),
        totalPrize: parseFloat(stake),
      },
      include: {
        creator: true,
      },
    });

    console.log(`[DB] Match created successfully: ${JSON.stringify(match)}`);
    return match;
  } catch (error) {
    // Properly format the error for logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("[DB] Error processing match:", { error: errorMessage });
    throw error;
  }
}

// Function to get match types for a list of match IDs
export async function getMatchTypes(matchIds: number[]) {
  try {
    console.log(`[DB] Fetching match types for IDs:`, matchIds);
    const matches = await prisma.match.findMany({
      where: {
        matchId: {
          in: matchIds,
        },
      },
      select: {
        matchId: true,
        matchType: true,
      },
    });

    // Convert to a map for easier lookup
    const matchTypeMap = new Map(
      matches.map((match) => [match.matchId, match.matchType])
    );

    console.log(`[DB] Found match types:`, Object.fromEntries(matchTypeMap));
    return matchTypeMap;
  } catch (error) {
    console.error("[DB] Error fetching match types:", error);
    throw error;
  }
}
