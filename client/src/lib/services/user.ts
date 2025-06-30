"use server";

import { prisma } from "@/lib/prisma";

// Function to update user stats after match completion
export async function updateUserStats({
    winnerId,
    loserId,
}: {
    winnerId: string;
    loserId: string;
}) {
    try {
        console.log(`[DB] Updating user stats - Winner: ${winnerId}, Loser: ${loserId}`);

        // Update winner stats
        await prisma.user.update({
            where: { id: winnerId },
            data: {
                totalMatches: { increment: 1 },
                totalWins: { increment: 1 },
            },
        });

        // Update loser stats
        await prisma.user.update({
            where: { id: loserId },
            data: {
                totalMatches: { increment: 1 },
                totalLosses: { increment: 1 },
            },
        });

        console.log(`[DB] User stats updated successfully`);
    } catch (error) {
        console.error("[DB] Error updating user stats:", error);
        throw error;
    }
}

// Function to get user by Discord ID
export async function getUserByDiscordId(discordId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { discordId },
            include: {
                matchesCreated: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
                participatedMatches: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
            },
        });
        return user;
    } catch (error) {
        console.error("[DB] Error getting user by Discord ID:", error);
        throw error;
    }
}

// Function to get user by wallet address
export async function getUserByWalletAddress(walletAddress: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { address: walletAddress },
            include: {
                matchesCreated: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
                participatedMatches: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
            },
        });
        return user;
    } catch (error) {
        console.error("[DB] Error getting user by wallet address:", error);
        throw error;
    }
}

// Function to link Discord ID to existing wallet user
export async function linkDiscordToWallet({
    discordId,
    walletAddress,
}: {
    discordId: string;
    walletAddress: string;
}) {
    try {
        // Validate inputs
        if (!discordId || typeof discordId !== 'string') {
            throw new Error(`Invalid Discord ID: ${discordId}`);
        }

        if (!walletAddress || typeof walletAddress !== 'string') {
            throw new Error(`Invalid wallet address: ${walletAddress}`);
        }

        // Validate wallet address format
        if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
            throw new Error(`Invalid wallet address format: ${walletAddress}`);
        }

        console.log(`[DB] Linking Discord ID ${discordId} to wallet ${walletAddress}`);

        // Check if Discord ID is already linked to another wallet
        const existingDiscordUser = await prisma.user.findUnique({
            where: { discordId },
        });

        if (existingDiscordUser && existingDiscordUser.address !== walletAddress) {
            throw new Error("Discord ID is already linked to a different wallet");
        }

        // Check if wallet is already linked to another Discord ID
        const existingWalletUser = await prisma.user.findUnique({
            where: { address: walletAddress },
        });

        if (existingWalletUser && existingWalletUser.discordId && existingWalletUser.discordId !== discordId) {
            throw new Error("Wallet is already linked to a different Discord ID");
        }

        // Update or create user
        const user = await prisma.user.upsert({
            where: { address: walletAddress },
            update: { discordId },
            create: {
                address: walletAddress,
                discordId,
            },
        });

        console.log(`[DB] Successfully linked Discord ID to wallet`);
        return user;
    } catch (error) {
        console.error("[DB] Error linking Discord to wallet:", error);
        throw error;
    }
}

// Function to unlink Discord ID from wallet
export async function unlinkDiscordFromWallet(discordId: string) {
    try {
        console.log(`[DB] Unlinking Discord ID ${discordId}`);

        const user = await prisma.user.findUnique({
            where: { discordId },
        });

        if (!user) {
            throw new Error("User not found");
        }

        // Check if user has active matches
        const activeMatches = await prisma.match.findMany({
            where: {
                OR: [
                    { creatorId: user.id, status: { in: ["PENDING", "OPEN", "FILLED"] } },
                    { participants: { some: { id: user.id } }, status: { in: ["PENDING", "OPEN", "FILLED"] } },
                ],
            },
        });

        if (activeMatches.length > 0) {
            throw new Error("Cannot unlink wallet while user has active matches");
        }

        // Unlink Discord ID (keep the user record)
        const updatedUser = await prisma.user.update({
            where: { discordId },
            data: { discordId: null },
        });

        console.log(`[DB] Successfully unlinked Discord ID`);
        return updatedUser;
    } catch (error) {
        console.error("[DB] Error unlinking Discord from wallet:", error);
        throw error;
    }
}

// Function to get user statistics
export async function getUserStats(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                totalMatches: true,
                totalWins: true,
                totalLosses: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new Error("User not found");
        }

        const winRate = user.totalMatches > 0 ? (user.totalWins / user.totalMatches) * 100 : 0;

        return {
            ...user,
            winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal place
        };
    } catch (error) {
        console.error("[DB] Error getting user stats:", error);
        throw error;
    }
}

// Function to get user's match history
export async function getUserMatchHistory(userId: string, limit: number = 20) {
    try {
        const matches = await prisma.match.findMany({
            where: {
                OR: [
                    { creatorId: userId },
                    { participants: { some: { id: userId } } },
                ],
            },
            include: {
                creator: true,
                participants: true,
                teams: {
                    include: {
                        members: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return matches;
    } catch (error) {
        console.error("[DB] Error getting user match history:", error);
        throw error;
    }
}

// Function to validate 1:1 Discord ID to wallet mapping
export async function validateUserMapping() {
    try {
        console.log(`[DB] Validating user mappings...`);

        // Check for duplicate Discord IDs
        const discordDuplicates = await prisma.user.groupBy({
            by: ["discordId"],
            where: { discordId: { not: null } },
            _count: { discordId: true },
            having: { discordId: { _count: { gt: 1 } } },
        });

        // Check for duplicate wallet addresses
        const walletDuplicates = await prisma.user.groupBy({
            by: ["address"],
            where: { address: { not: null } },
            _count: { address: true },
            having: { address: { _count: { gt: 1 } } },
        });

        const issues = [];

        if (discordDuplicates.length > 0) {
            issues.push(`Found ${discordDuplicates.length} Discord IDs with multiple users`);
        }

        if (walletDuplicates.length > 0) {
            issues.push(`Found ${walletDuplicates.length} wallet addresses with multiple users`);
        }

        if (issues.length > 0) {
            console.warn(`[DB] Mapping validation issues: ${issues.join(", ")}`);
            return { valid: false, issues };
        }

        console.log(`[DB] User mappings are valid`);
        return { valid: true, issues: [] };
    } catch (error) {
        console.error("[DB] Error validating user mappings:", error);
        throw error;
    }
} 