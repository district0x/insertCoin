import { TwitterApi } from "npm:twitter-api-v2@1.15.1";

// Validate required environment variables
const requiredEnvVars = [
  "TWITTER_API_KEY",
  "TWITTER_API_SECRET",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_TOKEN_SECRET",
] as const;

for (const envVar of requiredEnvVars) {
  if (!Deno.env.get(envVar)) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize Twitter client with validated credentials and configuration
const twitterClient = new TwitterApi({
  appKey: Deno.env.get("TWITTER_API_KEY")!,
  appSecret: Deno.env.get("TWITTER_API_SECRET")!,
  accessToken: Deno.env.get("TWITTER_ACCESS_TOKEN")!,
  accessSecret: Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")!,
});

// Get the client for read-write operations
const rwClient = twitterClient.readWrite;

export async function postTweet(content: string): Promise<{ id: string }> {
  try {
    if (!content || content.trim().length === 0) {
      throw new Error("Tweet content cannot be empty");
    }

    if (content.length > 280) {
      throw new Error(
        `Tweet content exceeds maximum length (${content.length}/280 characters)`
      );
    }

    // Verify credentials before tweeting
    try {
      await rwClient.v2.me();
    } catch (error) {
      console.error("Failed to verify credentials:", error);
      throw new Error(
        `Twitter authentication failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Use v2 API with explicit error handling
    const tweet = await rwClient.v2.tweet(content);

    if (!tweet.data?.id) {
      throw new Error("Failed to get tweet ID from response");
    }

    return { id: tweet.data.id };
  } catch (error) {
    // Add more context to the error
    console.error("Error posting tweet:", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
      content,
    });

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes("403")) {
        throw new Error(
          "Twitter API authentication failed. Please verify your API credentials and permissions."
        );
      }
      if (error.message.includes("401")) {
        throw new Error(
          "Twitter API authorization failed. Please check if your tokens are valid and have the required permissions."
        );
      }
      if (error.message.includes("429")) {
        throw new Error(
          "Twitter API rate limit exceeded. Please try again later."
        );
      }
    }

    // Rethrow with better context
    throw new Error(
      `Twitter API Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function formatMatchCreatedTweet(data: {
  matchId: number;
  matchType: string;
  stake: string;
}): string {
  return `🎮 New match created!
Match ID: #${data.matchId}
Type: ${data.matchType}
Stake: $${data.stake}
Waiting for opponent...`;
}

export function formatMatchJoinedTweet(data: {
  matchId: number;
  matchType: string;
  stake: string;
  creatorAddress?: string;
  joinerAddress?: string;
}): string {
  return `⚔️ Match is on!
Match ID: #${data.matchId}
Type: ${data.matchType}
Stake: $${data.stake}
Ready to battle!`;
}

export function formatMatchCompletedTweet(data: {
  matchId: number;
  matchType: string;
  stake: string;
  totalPrize: string;
  winnerAddress?: string;
}): string {
  return `🏆 Match completed!
Match ID: #${data.matchId}
Type: ${data.matchType}
Total Prize: $${data.totalPrize}
${data.winnerAddress ? `Winner: ${data.winnerAddress.substring(0, 6)}...${data.winnerAddress.substring(data.winnerAddress.length - 4)}` : 'No winner declared'}`;
}

export function formatDailyStatsTweet(data: {
  totalMatches: number;
  totalPrizePool: number;
  topPlayer?: { address: string; wins: number };
}): string {
  return `📊 Daily Stats Update
Total Matches: ${data.totalMatches}
Total Prize Pool: $${data.totalPrizePool}
${data.topPlayer ? `Top Player: ${data.topPlayer.address.substring(0, 6)}...${data.topPlayer.address.substring(data.topPlayer.address.length - 4)} (${data.topPlayer.wins} wins)` : ''}`;
} 