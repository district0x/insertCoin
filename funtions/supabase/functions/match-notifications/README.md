# Match Notifications Function

This Supabase Edge Function sends real-time notifications to Discord channels when match events occur on the OneVOne platform.

## Purpose

The Match Notifications function listens for match-related events via webhooks and direct API calls, then sends formatted notifications to the appropriate Discord channels. It handles various match lifecycle events including:

- Match Creation
- Player Joining
- Match Starting
- Match Completion
- Match Cancellation

## Environment Variables

This function requires the following environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for database operations |
| `DISCORD_BOT_TOKEN` | Discord bot token for sending messages to Discord channels |

## Setup Instructions

1. **Deploy the function**:
   ```bash
   supabase functions deploy match-notifications --no-verify-jwt
   ```

2. **Set environment variables** in the Supabase Dashboard:
   - Navigate to Settings > API > Functions > Environment Variables
   - Add the required variables listed above

3. **Configure webhooks in Supabase Dashboard**:
   - Navigate to Database > Webhooks
   - Create a new webhook with the following settings:
     - HTTP Method: POST
     - URL: `https://your-project-ref.supabase.co/functions/v1/match-notifications`
     - Table: Match
     - Events: INSERT and UPDATE
     - Important: Select "Include old record" option
     - Headers: Content-type: application/json

4. **Configure participant join webhooks** (optional):
   - Create another webhook for the _Participant table to notify when players join matches
   - HTTP Method: POST
   - URL: Same as above
   - Table: _Participant
   - Events: INSERT
   - Headers: Content-type: application/json

## Function Behavior

The function processes events based on status transitions:

1. **Match Created**: When a match status changes from PENDING to OPEN
2. **Player Joined**: When a new record is inserted in the _Participant table
3. **Match Started**: When a match status changes from OPEN to FILLED
4. **Match Completed**: When a match status changes to COMPLETED
5. **Match Cancelled**: When a match status changes to CANCELLED

For each valid event, the function:
1. Fetches detailed information about the match
2. Formats an appropriate Discord message with relevant details
3. Sends the notification to the match's Discord channel
4. Updates match status in the database if necessary

## Direct API Usage

This function can also be triggered directly via API call with the following payload format:

```json
{
  "type": "MATCH_CREATED|PLAYER_JOINED|MATCH_STARTED|MATCH_COMPLETED|MATCH_CANCELLED",
  "matchId": 123,
  "data": {
    "playerAddress": "0x...",
    "stake": "0.1",
    "matchType": "ONE_V_ONE",
    "winnerAddress": "0x...",
    "discordChannelId": "12345678901234567"
  }
}
```

## Troubleshooting

If notifications aren't being sent properly:

1. Check the function logs in Supabase Dashboard (Functions > Logs)
2. Verify that your Discord bot:
   - Has been added to your server
   - Has the "Send Messages" permission in the target channels
   - Has a valid token
3. Ensure all required environment variables are set
4. Verify that the match record has a valid `discordChannelId` field populated 