// @ts-ignore
import fetch from 'node-fetch';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API_BASE = 'https://discord.com/api/v10';

export async function sendDiscordRoomReadyMessage(roomId: string, matchId: string) {
    if (!DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN not set');
    if (!roomId) throw new Error('roomId is required');
    if (!matchId) throw new Error('matchId is required');

    const content = `:tada: The match is ready! Match ID: **${matchId}**\n[Click here to join the match](https://yourapp.com/matches/${matchId})`;

    const res = await fetch(`${DISCORD_API_BASE}/channels/${roomId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to send Discord message: ${error}`);
    }
} 