// app/api/postTournamentToDiscord.js

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

export async function POST(req) {
  const { tournamentId } = await req.json();

  if (!tournamentId) {
    return new Response(JSON.stringify({ error: "Missing tournamentId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch channel ID from Supabase
    const { data, error } = await supabase
      .from("tournament_channels")
      .select("channel_id")
      .eq("tournament_id", tournamentId)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Tournament not found");

    const channelId = data.channel_id;

    // Prepare message content
    const content = `New tournament created! Tournament ID: ${tournamentId}`;

    console.log("Posting tournament info to Discord...");
    console.log("Channel ID:", channelId);
    console.log("Content:", content);

    // Send message to Discord
    const discordWebhookUrl = `https://discord.com/api/v9/channels/${channelId}/messages`;
    const discordResponse = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    const discordData = await discordResponse.json();

    if (!discordResponse.ok) {
      throw new Error(discordData.error || "Failed to send message to Discord");
    }

    return new Response(
      JSON.stringify({
        message: "Tournament info posted to Discord successfully",
        discordResponse: discordData,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error posting tournament to Discord:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
