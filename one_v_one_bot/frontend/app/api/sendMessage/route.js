// app/api/sendMessage.js
// export const config = { runtime: "nodejs" }; // Use Node.js runtime for server-side operations

export async function POST(req) {
  const { channelId, content } = await req.json();
  //   console.log("req.body", req.json());
  console.log("channelId", channelId);
  console.log("content", content);

  // Check if the required fields are provided
  if (!channelId || !content) {
    return new Response(
      JSON.stringify({ error: "Missing channelId or content" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const discordWebhookUrl = `https://discord.com/api/v9/channels/${channelId}/messages`;
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN; // Ensure your bot token is securely stored in environment variables

    const response = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to send message");
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
