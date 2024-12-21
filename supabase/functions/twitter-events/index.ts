import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  postTweet,
  formatMatchTweet,
  formatTournamentTweet,
  formatDailyStatsTweet,
} from "../_shared/twitter.ts";

// Custom error types for better error handling
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class TwitterAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TwitterAPIError";
  }
}

// Logger utility with enhanced error logging
const logger = {
  info: (message: string, data?: any) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  },
  error: (message: string, error: Error | unknown, data?: any) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : String(error),
        data,
        timestamp: new Date().toISOString(),
      })
    );
  },
};

// Validation functions
function validateMatchEvent(record: any) {
  if (!record.game || !record.platform || !record.match_amount_usd) {
    throw new ValidationError("Invalid match data: missing required fields");
  }
}

function validateTournamentEvent(record: any) {
  if (!record.game_name || !record.amount || !record.num_entrants) {
    throw new ValidationError(
      "Invalid tournament data: missing required fields"
    );
  }
}

// Enhanced retry mechanism for Twitter API calls
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      logger.error(`Retry ${i + 1}/${maxRetries} failed`, error, {
        attempt: i + 1,
        maxRetries,
        delay: delay * Math.pow(2, i),
      });

      if (i === maxRetries - 1) {
        throw new TwitterAPIError(
          `Twitter API call failed after ${maxRetries} attempts: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, i))
      );
    }
  }
  throw new TwitterAPIError("Max retries reached for Twitter API call");
}

// Wrapper for Twitter API calls with additional error context
async function safePostTweet(
  tweetContent: string,
  context: any
): Promise<{ id: string }> {
  try {
    logger.info("Attempting to post tweet", {
      content: tweetContent,
      ...context,
    });
    const result = await retryOperation(() => postTweet(tweetContent));
    logger.info("Tweet posted successfully", {
      tweetId: result.id,
      ...context,
    });
    return result;
  } catch (error) {
    logger.error("Tweet posting failed", error, {
      content: tweetContent,
      ...context,
    });
    throw new TwitterAPIError(
      `Failed to post tweet: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Add enum types to match Python schema
enum PostType {
  MATCH_CREATED = "match_created",
  MATCH_JOINED = "match_joined",
  MATCH_COMPLETED = "match_completed",
  TOURNAMENT_CREATED = "tournament_created",
  DAILY_STATS = "daily_stats",
  MATCH_EVENT = "match_event",
}

enum PostStatus {
  SUCCESS = "success",
  FAILED = "failed",
  PENDING = "pending",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, source, record } = await req.json();
    logger.info("Received event", { type, source });

    // Handle match events
    if (source === "matches") {
      try {
        validateMatchEvent(record);

        if (type === "INSERT") {
          logger.info("Processing match creation", {
            matchId: record.match_id,
          });

          const tweetContent = formatMatchTweet({
            type: "created",
            game: record.game,
            platform: record.platform,
            match_amount_usd: record.match_amount_usd,
          });

          const { id: tweetId } = await safePostTweet(tweetContent, {
            type: "match_created",
            matchId: record.match_id,
          });
          await recordTweet("match_created", record.match_id, tweetId);
          logger.info("Match creation tweet posted", {
            matchId: record.match_id,
            tweetId,
          });
        }

        if (
          type === "UPDATE" &&
          record.player2_name &&
          record.player2_discord_id
        ) {
          logger.info("Processing match join", { matchId: record.match_id });

          const tweetContent = formatMatchTweet({
            type: "joined",
            game: record.game,
            platform: record.platform,
            match_amount_usd: record.match_amount_usd,
            player1_name: record.player1_name,
            player2_name: record.player2_name,
          });

          const { id: tweetId } = await safePostTweet(tweetContent, {
            type: "match_joined",
            matchId: record.match_id,
          });
          await recordTweet("match_joined", record.match_id, tweetId);
          logger.info("Match join tweet posted", {
            matchId: record.match_id,
            tweetId,
          });
        }
      } catch (error) {
        logger.error("Error processing match event", error, { record });
        await recordError("match_event", record.match_id, error);
        throw error;
      }
    }

    // Handle tournament events
    if (source === "tournaments" && type === "INSERT") {
      try {
        validateTournamentEvent(record);
        logger.info("Processing tournament creation", {
          tournamentId: record.tournament_id,
        });

        const tweetContent = formatTournamentTweet({
          game_name: record.game_name,
          amount: record.amount,
          num_entrants: record.num_entrants,
        });

        const { id: tweetId } = await safePostTweet(tweetContent, {
          type: "tournament_created",
          tournamentId: record.tournament_id,
        });
        await recordTweet(
          "tournament_created",
          record.tournament_id.toString(),
          tweetId
        );
        logger.info("Tournament creation tweet posted", {
          tournamentId: record.tournament_id,
          tweetId,
        });
      } catch (error) {
        logger.error("Error processing tournament event", error, { record });
        await recordError(
          "tournament_event",
          record.tournament_id.toString(),
          error
        );
        throw error;
      }
    }

    // Handle daily stats
    if (source === "cron") {
      try {
        logger.info("Processing daily stats");
        const stats = await getDailyStats();
        const tweetContent = formatDailyStatsTweet(stats);
        const { id: tweetId } = await safePostTweet(tweetContent, {
          type: "daily_stats",
          date: new Date().toISOString(),
        });
        await recordTweet("daily_stats", new Date().toISOString(), tweetId);
        logger.info("Daily stats tweet posted", { tweetId, stats });
      } catch (error) {
        logger.error("Error processing daily stats", error);
        await recordError("daily_stats", new Date().toISOString(), error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Error in main handler", error);

    const status = error instanceof ValidationError ? 400 : 500;
    const errorResponse = {
      error: error.message,
      type: error.name,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function recordTweet(
  type: string,
  referenceId: string,
  tweetId: string
): Promise<void> {
  try {
    logger.info("Recording tweet", { type, referenceId, tweetId });

    // Ensure type is a valid PostType
    if (!Object.values(PostType).includes(type as PostType)) {
      logger.error("Invalid post type", {
        type,
        validTypes: Object.values(PostType),
      });
      type = "match_created"; // Default to match_created if invalid
    }

    const record = {
      type,
      reference_id: referenceId,
      status: PostStatus.SUCCESS,
      tweet_id: tweetId,
      created_at: new Date().toISOString(),
    };

    logger.info("Attempting to insert tweet record", { record });

    const { error: dbError, data } = await supabaseAdmin
      .from("twitter_posts")
      .insert(record)
      .select()
      .single();

    if (dbError) {
      // Expand the database error object for better logging
      const detailedError = {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        requestId: dbError.requestId,
      };

      logger.error("Database error while recording tweet", detailedError, {
        type,
        referenceId,
        tweetId,
        failedRecord: record,
      });
      throw dbError;
    }

    logger.info("Successfully recorded tweet", { insertedRecord: data });
  } catch (error: any) {
    // Expand any error that occurs during the try block
    logger.error("Failed to record tweet in database", {
      error: {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        requestId: error?.requestId,
        stack: error?.stack,
      },
      context: {
        type,
        referenceId,
        tweetId,
      },
    });
    throw error;
  }
}

async function recordError(
  type: string,
  referenceId: string,
  error: Error | unknown
): Promise<void> {
  try {
    // Convert error to string properly
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "object"
        ? JSON.stringify(error)
        : String(error);

    logger.info("Recording error", {
      type,
      referenceId,
      errorMessage,
    });

    // Map match_event to match_created for database compatibility
    const dbType = type === "match_event" ? "match_created" : type;

    const record = {
      type: dbType,
      reference_id: referenceId,
      status: PostStatus.FAILED,
      error_message: errorMessage,
      created_at: new Date().toISOString(),
    };

    logger.info("Attempting to insert error record", { record });

    const { error: dbError, data } = await supabaseAdmin
      .from("twitter_posts")
      .insert(record)
      .select()
      .single();

    if (dbError) {
      // Expand the database error object for better logging
      const detailedError = {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        requestId: dbError.requestId,
      };

      logger.error("Database error while recording error", detailedError, {
        type,
        referenceId,
        originalError:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : JSON.stringify(error),
        failedRecord: record,
      });
      throw dbError;
    }

    logger.info("Successfully recorded error", { insertedRecord: data });
  } catch (dbError: any) {
    // Expand any error that occurs during the try block
    logger.error("Failed to record error in database", {
      error: {
        name: dbError?.name,
        message: dbError?.message,
        code: dbError?.code,
        details: dbError?.details,
        hint: dbError?.hint,
        requestId: dbError?.requestId,
        stack: dbError?.stack,
      },
      context: {
        type,
        referenceId,
        originalError:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : JSON.stringify(error),
      },
    });
  }
}

async function getDailyStats() {
  logger.info("Fetching daily stats");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    // Get total matches for today
    const { count: totalMatches, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("*", { count: "exact" })
      .gte("created_at", today.toISOString());

    if (matchError) throw matchError;

    // Get total prize pool for today
    const { data: prizePoolData, error: prizeError } = await supabaseAdmin
      .from("matches")
      .select("match_amount_usd")
      .gte("created_at", today.toISOString());

    if (prizeError) throw prizeError;

    const totalPrizePool =
      prizePoolData?.reduce((sum, match) => sum + match.match_amount_usd, 0) ||
      0;

    // Get top player for today
    const { data: topPlayerData, error: playerError } = await supabaseAdmin
      .from("match_results")
      .select("winner_discord_id, count")
      .gte("created_at", today.toISOString())
      .group_by("winner_discord_id")
      .order("count", { ascending: false })
      .limit(1);

    if (playerError) throw playerError;

    const stats = {
      total_matches: totalMatches || 0,
      total_prize_pool: totalPrizePool,
      top_player: {
        name: topPlayerData?.[0]?.winner_discord_id || "No winners",
        wins: topPlayerData?.[0]?.count || 0,
      },
    };

    logger.info("Daily stats fetched successfully", stats);
    return stats;
  } catch (error) {
    logger.error("Error fetching daily stats", error);
    throw error;
  }
}
