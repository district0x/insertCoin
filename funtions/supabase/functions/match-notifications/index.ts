// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import type { Database } from "../../types/database.types"

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// Discord configuration
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')!

interface MatchEvent {
  type: 'MATCH_CREATED' | 'PLAYER_JOINED' | 'MATCH_STARTED' | 'MATCH_COMPLETED' | 'MATCH_CANCELLED'
  matchId: number
  data: {
    playerAddress?: string
    stake?: string
    matchType?: string
    winnerAddress?: string
    discordChannelId?: string
  }
}

interface DatabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: {
    id: string
    matchId: number
    matchType: string
    status: string
    stake: number
    totalPrize: number
    creatorDiscordId: string | null
    discordChannelId: string | null
    winnerAddress: string | null
    [key: string]: any
  }
  old_record?: {
    id: string
    matchId: number
    status: string
    [key: string]: any
  }
}

// For participant join events
interface ParticipantWebhookPayload {
  type: 'INSERT'
  table: string
  schema: string
  record: {
    A: string // User ID
    B: string // Match ID
  }
}

async function sendDiscordNotification(content: string, channelId: string) {
  try {
    console.log(`Sending Discord notification to channel ${channelId}: ${content}`);
    const discordApiUrl = `https://discord.com/api/v9/channels/${channelId}/messages`
    const response = await fetch(discordApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
      },
      body: JSON.stringify({ 
        content,
        embeds: [{
          color: 0x0099ff,
          footer: {
            text: 'OneVOne Gaming Platform'
          },
          timestamp: new Date().toISOString()
        }]
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Discord API error:', { status: response.status, error: errorData });
      throw new Error(`Failed to send Discord notification: ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`)
    }
    console.log('Discord notification sent successfully');
  } catch (error) {
    console.error('Error sending Discord notification:', error)
    throw error
  }
}

async function getMatchDetails(matchId: number) {
  try {
    console.log(`Fetching match details for ID: ${matchId}`);
    const { data: match, error } = await supabase
      .from('Match')
      .select(`
        *,
        creator:User!Match_creatorId_fkey(address, discordId),
        participants:User!_Participant(address, discordId)
      `)
      .eq('matchId', matchId)
      .single()

    if (error) {
      console.error('Database error:', error);
      throw error
    }

    console.log('Match details retrieved:', match);
    return match
  } catch (error) {
    console.error(`Error fetching match details for ID ${matchId}:`, error);
    throw error;
  }
}

// Get user details by ID
async function getUserDetails(userId: string) {
  try {
    console.log(`Fetching user details for ID: ${userId}`);
    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Database error:', error);
      throw error
    }

    console.log('User details retrieved:', user);
    return user
  } catch (error) {
    console.error(`Error fetching user details for ID ${userId}:`, error);
    throw error;
  }
}

// Get match ID from match reference ID
async function getMatchIdFromReference(matchRefId: string) {
  try {
    console.log(`Fetching match ID for reference: ${matchRefId}`);
    const { data: match, error } = await supabase
      .from('Match')
      .select('matchId')
      .eq('id', matchRefId)
      .single()

    if (error) {
      console.error('Database error:', error);
      throw error
    }

    console.log('Match ID retrieved:', match.matchId);
    return match.matchId
  } catch (error) {
    console.error(`Error fetching match ID for reference ${matchRefId}:`, error);
    throw error;
  }
}

function convertWebhookToMatchEvent(payload: DatabaseWebhookPayload | ParticipantWebhookPayload): MatchEvent | null {
  console.log('Converting webhook payload to match event:', payload);
  
  // Handle participant join events (from the _Participant join table)
  if (payload.table === '_Participant' && payload.type === 'INSERT') {
    console.log('Processing participant join event');
    const participantPayload = payload as ParticipantWebhookPayload;
    
    return {
      type: 'PLAYER_JOINED',
      matchId: 0, // Will be populated later with the actual match ID
      data: {
        playerAddress: participantPayload.record.A // User ID, will get address later
      }
    };
  }
  
  // Only process Match table events for status changes
  if (payload.table !== 'Match') {
    console.log('Ignoring non-Match table event');
    return null;
  }

  const matchPayload = payload as DatabaseWebhookPayload;
  
  // Handle different status transitions
  if (matchPayload.type === 'UPDATE' && matchPayload.old_record) {
    const oldStatus = matchPayload.old_record.status;
    const newStatus = matchPayload.record.status;
    const channelId = matchPayload.record.discordChannelId || undefined;
    
    console.log(`Status transition: ${oldStatus} -> ${newStatus}`);

    if (oldStatus === 'PENDING' && newStatus === 'OPEN') {
      return {
        type: 'MATCH_CREATED',
        matchId: matchPayload.record.matchId,
        data: {
          matchType: matchPayload.record.matchType,
          stake: matchPayload.record.stake.toString(),
          discordChannelId: channelId
        }
      };
    }
    
    if (oldStatus === 'OPEN' && newStatus === 'FILLED') {
      return {
        type: 'MATCH_STARTED',
        matchId: matchPayload.record.matchId,
        data: {
          discordChannelId: channelId
        }
      };
    }
    
    // Only trigger COMPLETED notification if the status actually changed from a different status
    if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      return {
        type: 'MATCH_COMPLETED',
        matchId: matchPayload.record.matchId,
        data: {
          winnerAddress: matchPayload.record.winnerAddress || undefined,
          discordChannelId: channelId
        }
      };
    }
    
    // Only trigger CANCELLED notification if the status actually changed from a different status
    if (newStatus === 'CANCELLED' && oldStatus !== 'CANCELLED') {
      return {
        type: 'MATCH_CANCELLED',
        matchId: matchPayload.record.matchId,
        data: {
          discordChannelId: channelId
        }
      };
    }
  }

  return null;
}

async function handleMatchEvent(event: MatchEvent) {
  try {
    console.log('Processing match event:', event);
    
    // Special handling for PLAYER_JOINED events from the _Participant table
    if (event.type === 'PLAYER_JOINED' && event.matchId === 0 && event.data.playerAddress) {
      // Get user details first
      const userId = event.data.playerAddress;
      const user = await getUserDetails(userId);
      
      // Get match ID from reference if needed (for _Participant table events)
      const matchId = await getMatchIdFromReference(event.data.discordChannelId || '');
      event.matchId = matchId;
      event.data.playerAddress = user.address;
    }
    
    const match = await getMatchDetails(event.matchId)
    
    // Update discordChannelId if provided in the event
    if (event.data.discordChannelId && !match.discordChannelId) {
      console.log(`Updating match ${event.matchId} with Discord channel ID: ${event.data.discordChannelId}`);
      await supabase
        .from('Match')
        .update({ discordChannelId: event.data.discordChannelId })
        .eq('matchId', event.matchId)
    }

    // Use the channel ID from the match or fall back to the one from the event
    const channelId = match.discordChannelId || event.data.discordChannelId
    if (!channelId) {
      throw new Error('No Discord channel ID found for this match')
    }

    let notificationContent = ''

    switch (event.type) {
      case 'MATCH_CREATED':
        notificationContent = `🎮 **New Match Created!**\n\n` +
          `**Match:** #${event.matchId}\n` +
          `**Type:** ${event.data.matchType}\n` +
          `**Stake:** ${event.data.stake} ETH\n` +
          `**Created by:** ${match.creator?.discordId ? `<@${match.creator.discordId}>` : match.creator?.address}\n\n` +
          `🔗 **Join Match:** https://onevone.gg/matches/${event.matchId}`

        await supabase
          .from('Match')
          .update({ status: 'OPEN' })
          .eq('matchId', event.matchId)
        break

      case 'PLAYER_JOINED':
        notificationContent = `👋 **New Player Joined!**\n\n` +
          `**Match:** #${event.matchId}\n` +
          `**Player:** ${event.data.playerAddress}\n` +
          `**Prize Pool:** ${match.totalPrize} ETH\n\n` +
          `🔗 **View Match:** https://onevone.gg/matches/${event.matchId}`
        break

      case 'MATCH_STARTED':
        notificationContent = `🚀 **Match Started!**\n\n` +
          `**Match:** #${event.matchId}\n` +
          `**Type:** ${match.matchType}\n` +
          `**Prize Pool:** ${match.totalPrize} ETH\n\n` +
          `Good luck to all players! 🍀\n` +
          `🔗 **View Match:** https://onevone.gg/matches/${event.matchId}`

        await supabase
          .from('Match')
          .update({ status: 'FILLED' })
          .eq('matchId', event.matchId)
        break

      case 'MATCH_COMPLETED':
        const winner = event.data.winnerAddress
        notificationContent = `🏆 **Match Completed!**\n\n` +
          `**Match:** #${event.matchId}\n` +
          `**Winner:** ${winner}\n` +
          `**Prize:** ${match.totalPrize} ETH\n\n` +
          `Congratulations! 🎉\n` +
          `🔗 **View Match:** https://onevone.gg/matches/${event.matchId}`

        await supabase
          .from('Match')
          .update({ 
            status: 'COMPLETED',
            winnerAddress: winner
          })
          .eq('matchId', event.matchId)
        break

      case 'MATCH_CANCELLED':
        notificationContent = `❌ **Match Cancelled**\n\n` +
          `**Match:** #${event.matchId}\n` +
          `All stakes will be refunded.\n\n` +
          `🔗 **View Match:** https://onevone.gg/matches/${event.matchId}`

        await supabase
          .from('Match')
          .update({ status: 'CANCELLED' })
          .eq('matchId', event.matchId)
        break
    }

    if (notificationContent) {
      await sendDiscordNotification(notificationContent, channelId)
    }

    return { success: true, message: 'Event processed successfully' }
  } catch (error) {
    console.error('Error processing match event:', error)
    throw error
  }
}

serve(async (req) => {
  try {
    console.log('Received request:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

    const body = await req.json().catch((e) => {
      console.error('Error parsing request body:', e);
      throw new Error('Invalid JSON payload');
    });
    console.log('Request body:', body);
    
    let event: MatchEvent;
    
    // Check if this is a database webhook event
    if (body.type === 'INSERT' || body.type === 'UPDATE' || body.type === 'DELETE') {
      console.log('Processing database webhook event');
      const webhookEvent = convertWebhookToMatchEvent(body);
      
      if (!webhookEvent) {
        console.log('Event ignored - no action needed');
  return new Response(
          JSON.stringify({ message: 'Event ignored - no action needed' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      event = webhookEvent;
    } else {
      // Direct API call
      console.log('Processing direct API call');
      if (!body.type || !body.matchId) {
        console.error('Invalid event format:', body);
        return new Response(
          JSON.stringify({ error: 'Invalid event format: missing type or matchId' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      event = body as MatchEvent;
    }

    const result = await handleMatchEvent(event);

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/match-notifications' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
