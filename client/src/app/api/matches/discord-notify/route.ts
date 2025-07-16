import { NextRequest, NextResponse } from 'next/server';
import { sendDiscordRoomReadyMessage } from '@/lib/utils/discordNotify';
import { getDiscordChannelIdByRoomId } from '@/lib/services/match';

export async function POST(req: NextRequest) {
    try {
        const { roomId, discordChannelId, matchId } = await req.json();
        let channelId = discordChannelId;

        if (!channelId && roomId) {
            // Look up the Discord channel ID from Supabase using the roomId
            channelId = await getDiscordChannelIdByRoomId(roomId);
        }

        if (!channelId || !matchId) {
            return NextResponse.json({ error: 'Missing discordChannelId or matchId' }, { status: 400 });
        }

        // Optionally: update your DB here to link matchId to roomId

        await sendDiscordRoomReadyMessage(channelId, matchId);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
} 