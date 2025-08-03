"use server";

import { prisma } from "@/lib/prisma";
import { MatchStatus, MatchType } from "@prisma/client";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);



// Enhanced connection reset function
export async function resetPrismaConnection() {
    try {
        console.log('[DB] Resetting Prisma connection...');
        await prisma.$disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        await prisma.$connect();
        console.log('[DB] Prisma connection reset successfully');
    } catch (error) {
        console.error('[DB] Error resetting Prisma connection:', error);
        // Force disconnect and reconnect
        try {
            await prisma.$disconnect();
        } catch (disconnectError) {
            console.error('[DB] Error during disconnect:', disconnectError);
        }

        // Wait longer before reconnecting
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            await prisma.$connect();
            console.log('[DB] Prisma connection reconnected after force reset');
        } catch (connectError) {
            console.error('[DB] Error during reconnect:', connectError);
            throw connectError;
        }
    }
}

// Function to create a pending match from Discord bot
export async function createPendingMatch({
    roomId,
    type,
    discordId,
    stake,
}: {
    roomId: string;
    type: MatchType;
    discordId: string;
    stake: number;
}) {
    try {
        const match = await prisma.match.create({
            data: {
                roomId,
                matchType: type,
                status: MatchStatus.PENDING,
                creatorDiscordId: discordId,
                stake,
                totalPrize: stake * 2, // FIXED: Use total prize pool (stake * 2) instead of single player stake
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
    roomId,
    walletAddress,
    stakeAmount,
}: {
    roomId: string;
    walletAddress: string;
    stakeAmount?: number;
}) {
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`[DB] updateMatchWithWallet called with:`, {
                roomId,
                walletAddress,
                stakeAmount,
                roomIdType: typeof roomId,
                walletAddressType: typeof walletAddress,
                roomIdIsNull: roomId === null,
                walletAddressIsNull: walletAddress === null,
                roomIdIsUndefined: roomId === undefined,
                walletAddressIsUndefined: walletAddress === undefined,
            });

            // Use a transaction to ensure atomicity
            return await prisma.$transaction(async (tx) => {
                console.log(`[DB] Finding match with room ID ${roomId}`);

                // Find the match by room ID
                const match = await tx.match.findUnique({
                    where: { roomId },
                    include: { creator: true },
                });

                if (!match) {
                    throw new Error(`Match with room ID ${roomId} not found`);
                }

                console.log(`[DB] Found match:`, {
                    id: match.id,
                    roomId: match.roomId,
                    creatorDiscordId: match.creatorDiscordId,
                    stake: match.stake,
                    matchAmountUsd: match.matchAmountUsd,
                    tokenName: (match as any).tokenName,
                });

                // Upsert user with Discord ID and wallet
                let user;
                try {
                    user = await tx.user.upsert({
                        where: { discordId: match.creatorDiscordId! },
                        update: {
                            address: walletAddress,
                            updatedAt: new Date(),
                        },
                        create: {
                            discordId: match.creatorDiscordId!,
                            address: walletAddress,
                        },
                    });
                } catch (upsertError) {
                    // If upsert fails due to address constraint, try to find existing user and update
                    if (upsertError instanceof Error && upsertError.message.includes('Unique constraint failed on the fields: (`address`)')) {
                        console.log(`[DB] Address constraint conflict detected. Finding existing user with address ${walletAddress}`);

                        // Find existing user with this address
                        const existingUser = await tx.user.findUnique({
                            where: { address: walletAddress }
                        });

                        if (existingUser) {
                            // Update the existing user's discordId if it's different
                            if (existingUser.discordId !== match.creatorDiscordId) {
                                user = await tx.user.update({
                                    where: { address: walletAddress },
                                    data: {
                                        discordId: match.creatorDiscordId!,
                                        updatedAt: new Date(),
                                    }
                                });
                            } else {
                                user = existingUser;
                            }
                        } else {
                            throw upsertError; // Re-throw if we can't resolve the conflict
                        }
                    } else {
                        throw upsertError; // Re-throw other errors
                    }
                }

                console.log(`[DB] Discord match - upserting user with Discord ID ${match.creatorDiscordId} and wallet ${walletAddress}`);

                // Update match with creator and status
                console.log(`[DB] Updating match ${roomId} with creator ID ${user.id}`);

                // Calculate the correct stake amount based on token type
                let finalStakeAmount = stakeAmount;
                if (!finalStakeAmount) {
                    // Fallback to database value if no stakeAmount provided
                    if ((match as any).tokenName === "MATCH") {
                        // For MATCH tokens, use the stake value directly (no USD conversion)
                        finalStakeAmount = match.stake;
                    } else {
                        // For ETH, use the database stake value
                        finalStakeAmount = match.stake;
                    }
                }

                const updatedMatch = await tx.match.update({
                    where: { id: match.id },
                    data: {
                        creatorId: user.id,
                        creatorAddress: walletAddress,
                        status: MatchStatus.OPEN,
                        stake: finalStakeAmount,
                        totalPrize: finalStakeAmount * 2, // FIXED: Use total prize pool (stake * 2)
                    },
                    include: {
                        creator: true,
                    },
                });

                console.log(
                    `[DB] Match updated successfully: ${JSON.stringify(updatedMatch)}`
                );
                return updatedMatch;
            }, {
                maxWait: 10000, // 10 seconds max wait for transaction
                timeout: 30000,  // 30 seconds timeout
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error) || "Unknown error occurred";
            console.error(`[DB] Error updating match with wallet (attempt ${attempt + 1}):`, errorMessage);

            // Check if it's a connection pool or prepared statement error
            if ((errorMessage.includes("prepared statement") || errorMessage.includes("connection pool")) && attempt < maxRetries - 1) {
                console.log(`[DB] Connection error detected, resetting connection and retrying...`);
                await resetPrismaConnection();
                // Wait longer between retries for connection errors
                await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
                continue;
            }

            // If it's the last attempt or not a connection error, throw
            throw new Error(errorMessage);
        }
    }
    throw new Error("Failed to update match with wallet after multiple retries.");
}

// Function to update match with contract match ID after creation
export async function updateMatchWithContractId({
    roomId,
    contractMatchId,
}: {
    roomId: string;
    contractMatchId: number;
}) {
    try {
        console.log(`[DB] Updating match ${roomId} with contract match ID ${contractMatchId}`);

        const updatedMatch = await prisma.match.update({
            where: { roomId },
            data: {
                matchId: contractMatchId,
            },
            include: {
                creator: true,
            },
        });

        console.log(`[DB] Match updated with contract ID: ${JSON.stringify(updatedMatch)}`);
        return updatedMatch;
    } catch (error) {
        console.error("[DB] Error updating match with contract ID:", error);
        throw error;
    }
}

// Function to find match by room ID
export async function findMatchByRoomId(roomId: string) {
    try {
        return await prisma.match.findUnique({
            where: { roomId },
            include: { creator: true },
        });
    } catch (error) {
        console.error("Error finding match by room ID:", error);
        throw error;
    }
}

// Function to find match by Discord ID (for backward compatibility)
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

// Function to create a regular match in the database
export async function createMatchInDb({
    walletAddress,
    matchType,
    stake,
    matchId,
    tokenName,
}: {
    walletAddress: string;
    matchType: MatchType;
    stake: string;
    matchId: number;
    tokenName: string | null;
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

        let match;
        if (existingMatch) {
            console.log(`[DB] Updating existing match with ID ${matchId}`);
            match = await prisma.match.update({
                where: { matchId },
                data: {
                    matchType,
                    status: MatchStatus.OPEN,
                    creatorId: user.id,
                    stake: parseFloat(stake),
                    totalPrize: parseFloat(stake) * 2, // FIXED: Use total prize pool (stake * 2)
                    tokenName: tokenName || null,
                },
                include: {
                    creator: true,
                },
            });
            console.log(`[DB] Match updated successfully: ${JSON.stringify(match)}`);
        } else {
            // If no existing match, create new one
            console.log(`[DB] Creating new match with ID ${matchId}`);
            match = await prisma.match.create({
                data: {
                    matchId,
                    matchType,
                    status: MatchStatus.OPEN,
                    creatorId: user.id,
                    stake: parseFloat(stake),
                    totalPrize: parseFloat(stake) * 2, // FIXED: Use total prize pool (stake * 2)
                    tokenName: tokenName || null,
                },
                include: {
                    creator: true,
                },
            });
            console.log(`[DB] Match created successfully: ${JSON.stringify(match)}`);
        }

        // Add the creator as a participant in the match
        console.log(`[DB] Adding creator as participant to match`);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                participatedMatches: {
                    connect: { id: match.id }
                }
            }
        });

        // Create team records based on match type
        if (matchType === 'ONE_V_ONE') {
            // For 1v1 matches, create two teams (team A and team B)
            console.log(`[DB] Creating Team A for 1v1 match`);
            await prisma.team.create({
                data: {
                    matchId: match.id,
                    isTeamA: true,
                    members: {
                        create: {
                            userId: user.id
                        }
                    }
                }
            });

            console.log(`[DB] Creating Team B for 1v1 match`);
            await prisma.team.create({
                data: {
                    matchId: match.id,
                    isTeamA: false
                }
            });

            console.log(`[DB] Teams created for 1v1 match`);
        } else if (matchType === 'TWO_V_TWO') {
            // For 2v2 matches, create two teams with initially one member in team A
            console.log(`[DB] Creating Team A for 2v2 match`);
            await prisma.team.create({
                data: {
                    matchId: match.id,
                    isTeamA: true,
                    members: {
                        create: {
                            userId: user.id
                        }
                    }
                }
            });

            console.log(`[DB] Creating Team B for 2v2 match`);
            await prisma.team.create({
                data: {
                    matchId: match.id,
                    isTeamA: false
                }
            });

            console.log(`[DB] Teams created for 2v2 match`);
        } else if (matchType === 'FIVE_V_FIVE') {
            // For 5v5 matches, create two teams with initially one member in team A
            console.log(`[DB] Creating Team A for 5v5 match`);
            await prisma.team.create({
                data: {
                    matchId: match.id,
                    isTeamA: true,
                    members: {
                        create: {
                            userId: user.id
                        }
                    }
                }
            });

            console.log(`[DB] Creating Team B for 5v5 match`);
            await prisma.team.create({
                data: {
                    matchId: match.id,
                    isTeamA: false
                }
            });

            console.log(`[DB] Teams created for 5v5 match`);
        }

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

// Function to handle a user joining a match in the database
export async function joinMatchInDb({
    walletAddress,
    matchId,
    isTeamA = false, // For 2v2 and 5v5, which team to join
}: {
    walletAddress: string;
    matchId: number;
    isTeamA?: boolean;
}) {
    try {
        console.log(`[DB] Processing join for wallet ${walletAddress} to match ${matchId}`);

        // Validate the inputs
        if (!walletAddress || !matchId) {
            throw new Error("Wallet address and match ID are required");
        }

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

        // Get the match
        console.log(`[DB] Finding match with ID ${matchId}`);
        const match = await prisma.match.findUnique({
            where: { matchId }
        });

        if (!match) {
            throw new Error(`Match with ID ${matchId} not found`);
        }

        console.log(`[DB] Found match: ${JSON.stringify({
            id: match.id,
            matchId: match.matchId,
            status: match.status,
            matchType: match.matchType
        })}`);

        // For 1v1 matches, update player2DiscordId and player2Address when second player joins
        if (match.matchType === 'ONE_V_ONE') {
            console.log(`[DB] Updating player2 information for 1v1 match ${matchId}`);

            // Get user's Discord ID if available
            const userWithDiscord = await prisma.user.findUnique({
                where: { id: user.id },
                select: { discordId: true }
            });

            await prisma.match.update({
                where: { matchId },
                data: {
                    opponentDiscordId: userWithDiscord?.discordId || null,
                    player2Address: walletAddress,
                    status: 'OPEN' // Update status to OPEN when second player joins
                }
            });

            console.log(`[DB] Updated match ${matchId} with player2 info:`, {
                opponentDiscordId: userWithDiscord?.discordId,
                player2Address: walletAddress
            });
        }

        return match;
    } catch (error) {
        // Properly format the error for logging
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error("[DB] Error processing join:", { error: errorMessage });
        throw error;
    }
}

// Function to sync database match ID with smart contract
export async function syncMatchIdWithContract(contractNextMatchId: number): Promise<void> {
    try {
        console.log(`[DB] Syncing database with contract nextMatchId: ${contractNextMatchId}`);

        // Get the highest match ID in the database
        const lastMatch = await prisma.match.findFirst({
            orderBy: { matchId: "desc" },
        });

        const dbNextMatchId = (lastMatch?.matchId ?? 0) + 1;

        if (dbNextMatchId !== contractNextMatchId) {
            console.log(`[DB] ID mismatch detected: DB nextMatchId=${dbNextMatchId}, Contract nextMatchId=${contractNextMatchId}`);

            // If contract is ahead, we need to create placeholder matches
            if (contractNextMatchId > dbNextMatchId) {
                console.log(`[DB] Contract is ahead by ${contractNextMatchId - dbNextMatchId} matches`);

                // Create placeholder matches to sync up
                for (let i = dbNextMatchId; i < contractNextMatchId; i++) {
                    await prisma.match.create({
                        data: {
                            matchId: i,
                            matchType: 'ONE_V_ONE',
                            status: 'CANCELLED',
                            stake: 0,
                            totalPrize: 0,
                        },
                    });
                }
                console.log(`[DB] Created ${contractNextMatchId - dbNextMatchId} placeholder matches`);
            }
        } else {
            console.log(`[DB] Database and contract are in sync: nextMatchId=${contractNextMatchId}`);
        }
    } catch (error) {
        console.error("[DB] Error syncing match IDs:", error);
        throw error;
    }
}

export async function getDiscordChannelIdByRoomId(roomId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('Match')
        .select('discordChannelId')
        .eq('roomId', roomId)
        .single();

    if (error || !data) throw new Error('Could not find Discord channel ID for this room');
    return data.discordChannelId;
} 