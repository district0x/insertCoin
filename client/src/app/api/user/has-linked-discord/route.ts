import { NextRequest, NextResponse } from "next/server";
import { hasLinkedDiscordId } from "@/lib/services/user";

export async function POST(request: NextRequest) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress) {
            return NextResponse.json(
                { error: "Wallet address is required" },
                { status: 400 }
            );
        }

        const hasDiscordId = await hasLinkedDiscordId(walletAddress);

        return NextResponse.json({
            hasLinkedDiscordId: hasDiscordId,
            walletAddress
        });

    } catch (error) {
        console.error("Error checking Discord ID link:", error);
        return NextResponse.json(
            {
                error: "Failed to check Discord ID link",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
} 