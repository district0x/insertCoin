// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  postTweet,
  formatMatchCreatedTweet,
  formatMatchJoinedTweet,
  formatMatchCompletedTweet,
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

// Enhanced logger utility with more detail
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
  debug: (message: string, data?: any) => {
    console.log(
      JSON.stringify({
        level: "debug",
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

// Log environment variables (without exposing secrets)
logger.debug("Environment check", {
  hasTwitterApiKey: Boolean(Deno.env.get("TWITTER_API_KEY")),
  hasTwitterApiSecret: Boolean(Deno.env.get("TWITTER_API_SECRET")),
  hasTwitterAccessToken: Boolean(Deno.env.get("TWITTER_ACCESS_TOKEN")),
  hasTwitterAccessTokenSecret: Boolean(Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")),
  hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
  hasSupabaseServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
});

// Validation functions
function validateMatchEvent(record: any) {
  logger.debug("Validating match event", { record });
  if (!record?.matchId) {
    throw new ValidationError("Invalid match data: missing matchId");
  }
  if (!record?.matchType) {
    throw new ValidationError("Invalid match data: missing matchType");
  }
  if (record?.stake === undefined) {
    throw new ValidationError("Invalid match data: missing stake");
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
      logger.debug(`Attempt ${i + 1}/${maxRetries}`);
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

// Define post types based on the current application events
enum PostType {
  MATCH_CREATED = "match_created",
  MATCH_JOINED = "match_joined",
  MATCH_COMPLETED = "match_completed",
  DAILY_STATS = "daily_stats",
}

enum PostStatus {
  SUCCESS = "success",
  FAILED = "failed",
  PENDING = "pending",
}

// Check if a tweet has already been sent for this event
async function hasTweetBeenSent(type: string, referenceId: string | number): Promise<boolean> {
  // Always return false since we're not tracking sent tweets
  return false;
}

// Modified function to skip storing tweet info in database
async function recordTweet(
  type: string,
  referenceId: string | number,
  tweetId: string
) {
  logger.debug("Tweet recorded (in memory only)", { type, referenceId, tweetId });
  // We're not storing tweets in the database
}

// Modified function to skip storing errors in database
async function recordError(
  type: string,
  referenceId: string | number,
  error: Error | unknown
) {
  logger.debug("Error recorded (in memory only)", { 
    type, 
    referenceId, 
    error: error instanceof Error ? error.message : String(error) 
  });
  // We're not storing errors in the database
}

// Get match details for tweeting
async function getMatchDetails(matchId: number) {
  try {
    logger.debug(`Fetching match details for ID: ${matchId}`);
    const { data, error } = await supabaseAdmin
      .from("Match")
      .select(`
        *,
        creator:User!Match_creatorId_fkey(address, discordId),
        participants:User!_Participant(address, discordId)
      `)
      .eq("matchId", matchId)
      .single();

    if (error) {
      logger.error("Database error when fetching match", error);
      throw error;
    }
    
    logger.debug("Match details retrieved", { matchData: data });
    return data;
  } catch (error) {
    logger.error(`Failed to get match details for matchId ${matchId}`, error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const body = await req.json();
    logger.info("Received webhook payload", { body });
    
    // Extract the relevant fields
    const { type, source, record, old_record } = body;
    
    // Infer source if not explicitly provided
    let eventSource = source;
    if (!eventSource && record) {
      // Check if this looks like a Match record
      if (record.matchId !== undefined && record.matchType !== undefined) {
        eventSource = "Match";
        logger.info("Inferred source as 'Match' from record structure", { recordKeys: Object.keys(record) });
      }
    }
    
    logger.info("Processing event", { type, source: eventSource, recordId: record?.id });

    // Handle Match table events
    if (eventSource === "Match") {
      try {
        validateMatchEvent(record);
        const matchId = record.matchId;
        const matchType = record.matchType;
        const stake = record.stake?.toString() || "0";
        const status = record.status;
        
        // Try to determine old status from various possible sources
        let oldStatus;
        if (old_record && old_record.status) {
          oldStatus = old_record.status;
        } else if (record.old_status) {
          oldStatus = record.old_status;
        } else if (type === "INSERT") {
          // For new inserts, we can assume there's no previous status
          oldStatus = null;
        } else {
          // If we can't determine old status, log but continue
          logger.debug("Could not determine old status", { record, old_record });
          oldStatus = null;
        }
        
        logger.debug("Match event details", { 
          matchId, 
          matchType, 
          stake, 
          status, 
          oldStatus,
          type
        });

        // Handle INSERT (new match creation) or open match
        if (type === "INSERT" || 
            (status === "OPEN" && (oldStatus === "PENDING" || !oldStatus)) ||
            (status === "OPEN" && !type) || // Handle case where type is not specified
            (status === "OPEN" && type === "UPDATE" && !await hasTweetBeenSent(PostType.MATCH_CREATED, matchId))) { // Handle case where match is OPEN but no creation tweet was sent
          
          logger.info("Processing match creation", { matchId });
          
          const tweetContent = formatMatchCreatedTweet({
            matchId,
            matchType,
            stake,
          });

          logger.debug("Tweet content for match creation", { tweetContent });

          const { id: tweetId } = await safePostTweet(tweetContent, {
            type: PostType.MATCH_CREATED,
            matchId,
          });
          
          await recordTweet(PostType.MATCH_CREATED, matchId, tweetId);
          
          logger.info("Match creation tweet posted", {
            matchId,
            tweetId,
          });
          
          return new Response(
            JSON.stringify({ success: true, tweetId }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Match joined (when status changes to FILLED)
        if (type === "UPDATE" && status === "FILLED" && oldStatus === "OPEN") {
          // Check if we've already tweeted about this match join
          const tweetAlreadySent = await hasTweetBeenSent(PostType.MATCH_JOINED, matchId);
          if (tweetAlreadySent) {
            logger.info("Match joined tweet already sent, skipping", { matchId });
            return new Response(
              JSON.stringify({ success: true, message: "Tweet already sent" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          logger.info("Processing match join", { matchId });

          // Get additional match details
          const matchDetails = await getMatchDetails(matchId);

          const tweetContent = formatMatchJoinedTweet({
            matchId,
            matchType,
            stake,
            creatorAddress: matchDetails.creator?.address,
            joinerAddress: matchDetails.participants?.[1]?.address,
          });

          logger.debug("Tweet content for match join", { tweetContent });

          const { id: tweetId } = await safePostTweet(tweetContent, {
            type: PostType.MATCH_JOINED,
            matchId,
          });
          
          await recordTweet(PostType.MATCH_JOINED, matchId, tweetId);
          
          logger.info("Match join tweet posted", {
            matchId,
            tweetId,
          });
          
          return new Response(
            JSON.stringify({ success: true, tweetId }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Match completed (when status changes to COMPLETED)
        if (type === "UPDATE" && status === "COMPLETED" && oldStatus !== "COMPLETED") {
          // Check if we've already tweeted about this match completion
          const tweetAlreadySent = await hasTweetBeenSent(PostType.MATCH_COMPLETED, matchId);
          if (tweetAlreadySent) {
            logger.info("Match completion tweet already sent, skipping", { matchId });
            return new Response(
              JSON.stringify({ success: true, message: "Tweet already sent" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          logger.info("Processing match completion", { matchId });

          // Get additional match details
          const matchDetails = await getMatchDetails(matchId);

          const tweetContent = formatMatchCompletedTweet({
            matchId,
            matchType,
            stake,
            totalPrize: record.totalPrize?.toString() || (parseFloat(stake) * 2).toString(),
            winnerAddress: record.winnerAddress,
          });

          logger.debug("Tweet content for match completion", { tweetContent });

          const { id: tweetId } = await safePostTweet(tweetContent, {
            type: PostType.MATCH_COMPLETED,
            matchId,
          });
          
          await recordTweet(PostType.MATCH_COMPLETED, matchId, tweetId);
          
          logger.info("Match completion tweet posted", {
            matchId,
            tweetId,
          });
          
          return new Response(
            JSON.stringify({ success: true, tweetId }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // If we reach here, the event didn't trigger any tweet
        logger.info("Event did not trigger a tweet", { 
          type, 
          matchId, 
          status, 
          oldStatus 
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Event received but did not trigger a tweet" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        logger.error("Error processing match event", error, { record });
        await recordError("match_event", record.matchId, error);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    }

    // Default response for unhandled events
    logger.info("Unhandled event source", { source: eventSource });
    return new Response(
      JSON.stringify({ success: true, message: "Event received but no action taken" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Error processing request", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}); 