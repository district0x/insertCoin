import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: "Wallet address is required" },
                { status: 400 }
            );
        }

        console.log(`[TEST-DB] Testing database connection for wallet: ${walletAddress}`);

        // Create a fresh Prisma client
        // const prisma = new PrismaClient({
        //     log: ['error', 'warn'],
        // });

        try {
            // Test connection
            await prisma.$connect();
            console.log("[TEST-DB] Database connection successful");

            // Check if user exists
            const user = await prisma.user.findUnique({
                where: { address: walletAddress },
                select: {
                    id: true,
                    address: true,
                    discordId: true,
                    username: true,
                    createdAt: true
                }
            });

            console.log("[TEST-DB] User query result:", user);

            // Also check all users with Discord IDs
            const usersWithDiscord = await prisma.user.findMany({
                where: {
                    discordId: { not: null }
                },
                select: {
                    address: true,
                    discordId: true,
                    username: true
                }
            });

            console.log("[TEST-DB] All users with Discord IDs:", usersWithDiscord);

            return NextResponse.json({
                success: true,
                user,
                usersWithDiscord,
                hasLinkedDiscordId: user?.discordId !== null && user?.discordId !== undefined
            });

        } finally {
            await prisma.$disconnect();
        }

    } catch (error) {
        console.error("[TEST-DB] Error:", error);
        return NextResponse.json(
            {
                error: "Database test failed",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
} 