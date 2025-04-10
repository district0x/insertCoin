'use server';

import { prisma } from '@/lib/prisma';
import { TournamentStatus } from '../../types/tournament';
import { TournamentStatus as PrismaTournamentStatus } from '@prisma/client';

// Map app TournamentStatus to Prisma TournamentStatus
const tournamentStatusMap: Record<TournamentStatus, PrismaTournamentStatus> = {
    CREATED: PrismaTournamentStatus.CREATED,
    FILLING: PrismaTournamentStatus.FILLING,
    FILLED: PrismaTournamentStatus.IN_PROGRESS, // Map FILLED to IN_PROGRESS for Prisma
    IN_PROGRESS: PrismaTournamentStatus.IN_PROGRESS,
    COMPLETED: PrismaTournamentStatus.COMPLETED,
    CANCELLED: PrismaTournamentStatus.CANCELLED
};

/**
 * Creates or updates a tournament record in the database based on on-chain data
 */
export async function syncTournamentWithDb({
    tournamentId,
    status,
    entryFee,
    tokenAddress,
    totalPrize,
    maxParticipants
}: {
    tournamentId: number;
    status: TournamentStatus;
    entryFee: number;
    tokenAddress?: string;
    totalPrize: number;
    maxParticipants: number;
}) {
    try {
        const tournament = await prisma.tournament.upsert({
            where: { tournamentId },
            update: {
                status: tournamentStatusMap[status],
                entryFee,
                tokenAddress,
                totalPrize,
                maxParticipants,
                updatedAt: new Date()
            },
            create: {
                tournamentId,
                status: tournamentStatusMap[status],
                entryFee,
                tokenAddress,
                totalPrize,
                maxParticipants
            }
        });

        return { success: true, tournament };
    } catch (error) {
        console.error('Error syncing tournament with database:', error);
        return { success: false, error };
    }
}

/**
 * Updates a tournament's status in the database
 */
export async function updateTournamentStatus({
    tournamentId,
    status
}: {
    tournamentId: number;
    status: PrismaTournamentStatus;
}) {
    try {
        const tournament = await prisma.tournament.update({
            where: { tournamentId },
            data: {
                status,
                updatedAt: new Date()
            }
        });

        return { success: true, tournament };
    } catch (error) {
        console.error('Error updating tournament status:', error);
        return { success: false, error };
    }
}

/**
 * Updates a tournament's prize pool in the database
 */
export async function updateTournamentPrize({
    tournamentId,
    totalPrize
}: {
    tournamentId: number;
    totalPrize: number;
}) {
    try {
        const tournament = await prisma.tournament.update({
            where: { tournamentId },
            data: {
                totalPrize,
                updatedAt: new Date()
            }
        });

        return { success: true, tournament };
    } catch (error) {
        console.error('Error updating tournament prize:', error);
        return { success: false, error };
    }
}

/**
 * Adds a participant to a tournament in the database
 */
export async function addTournamentParticipant({
    tournamentId,
    walletAddress
}: {
    tournamentId: number;
    walletAddress: string;
}) {
    try {
        // Find the user by wallet address
        const user = await prisma.user.findUnique({
            where: { address: walletAddress }
        });

        // If user doesn't exist, create a new one
        const userId = user?.id ||
            (await prisma.user.create({
                data: {
                    address: walletAddress
                }
            })).id;

        // Add the user to the tournament participants
        const tournament = await prisma.tournament.update({
            where: { tournamentId },
            data: {
                participants: {
                    connect: { id: userId }
                },
                updatedAt: new Date()
            }
        });

        return { success: true, tournament };
    } catch (error) {
        console.error('Error adding tournament participant:', error);
        return { success: false, error };
    }
}

/**
 * Gets all tournaments from the database
 */
export async function getTournaments() {
    try {
        const tournaments = await prisma.tournament.findMany({
            include: {
                participants: true
            },
            orderBy: {
                tournamentId: 'desc'
            }
        });

        return { success: true, tournaments };
    } catch (error) {
        console.error('Error getting tournaments:', error);
        return { success: false, error };
    }
}

/**
 * Gets a tournament by its ID from the database
 */
export async function getTournamentById(tournamentId: number) {
    try {
        const tournament = await prisma.tournament.findUnique({
            where: { tournamentId },
            include: {
                participants: true
            }
        });

        return { success: true, tournament };
    } catch (error) {
        console.error('Error getting tournament by ID:', error);
        return { success: false, error };
    }
}

/**
 * Updates tournament winners in the database
 * Since there's no direct winners field in the Tournament model, 
 * we'll create a separate tournamentWinners field to track winners
 */
export async function updateTournamentWinners({
    tournamentId,
    winners
}: {
    tournamentId: number;
    winners: string[];
}) {
    try {
        // First, get the tournament to ensure it exists
        const tournament = await prisma.tournament.findUnique({
            where: { tournamentId }
        });

        if (!tournament) {
            return { success: false, error: 'Tournament not found' };
        }

        // Find users by wallet addresses
        const userPromises = winners.map(address =>
            prisma.user.findUnique({
                where: { address }
            })
        );

        const users = await Promise.all(userPromises);

        // Filter out null values and get user IDs
        const existingUsers = users.filter(user => user !== null) as { id: string }[];

        // If some users don't exist, create them
        const missingAddresses = winners.filter((address, index) => users[index] === null);
        const newUsers = [];

        if (missingAddresses.length > 0) {
            for (const address of missingAddresses) {
                const newUser = await prisma.user.create({
                    data: { address }
                });
                newUsers.push(newUser);
            }
        }

        // All winner user IDs
        const winnerUserIds = [
            ...existingUsers.map(user => user.id),
            ...newUsers.map(user => user.id)
        ];

        // Update tournament status to COMPLETED since winners are being declared
        const updatedTournament = await prisma.tournament.update({
            where: { tournamentId },
            data: {
                status: PrismaTournamentStatus.COMPLETED,
                updatedAt: new Date()
            }
        });

        // Since we don't have a direct winners field in the Tournament model,
        // we'll return the tournament with the winner user IDs for the API to use
        return {
            success: true,
            tournament: updatedTournament,
            winnerUserIds
        };
    } catch (error) {
        console.error('Error updating tournament winners:', error);
        return { success: false, error };
    }
} 