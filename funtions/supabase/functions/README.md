# OneVOne Supabase Edge Functions

Edge Functions for the OneVOne gaming platform, handling match notifications, webhooks, and real-time updates between the platform and Discord.

## Functions

### match-notifications

A real-time notification service that handles match events and sends updates to Discord channels.

#### Features
- Real-time match status updates
- Discord channel notifications
- Database webhook processing
- Smart error handling and logging

#### Supported Events
- `MATCH_CREATED` - When a new match is created
- `PLAYER_JOINED` - When a player joins a match
- `MATCH_STARTED` - When a match begins
- `MATCH_COMPLETED` - When a match is finished
- `MATCH_CANCELLED` - When a match is cancelled

#### Notification Format
Each notification includes:
- Match ID and type
- Stake amounts and prize pools
- Player information
- Match status updates
- Direct links to matches

## Prerequisites

- Supabase CLI
- Deno runtime
- Discord Bot Token
- Supabase project with database access

## Environment Setup

1. Create a `supabase/.env` file with:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Discord Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token
```

## Development

### Local Development

1. Start Supabase locally:
```bash
supabase start
```

2. Run function in development mode:
```bash
supabase functions serve match-notifications --env-file supabase/.env
```

3. Test the function:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/match-notifications' \
  --header 'Content-Type: application/json' \
  --data '{
    "type": "MATCH_CREATED",
    "matchId": 123,
    "data": {
      "matchType": "ONE_V_ONE",
      "stake": "0.1",
      "discordChannelId": "channel_id"
    }
  }'
```

### Database Webhook Events

The function handles database webhook events in this format:
```json
{
  "type": "UPDATE",
  "table": "Match",
  "schema": "public",
  "record": {
    "id": "uuid",
    "matchId": 123,
    "matchType": "ONE_V_ONE",
    "status": "OPEN",
    "stake": 0.1,
    "totalPrize": 0.2,
    "creatorDiscordId": "discord_id",
    "discordChannelId": "channel_id"
  },
  "old_record": {
    "status": "PENDING"
  }
}
```

## Deployment

1. Deploy the function:
```bash
supabase functions deploy match-notifications
```

2. Set production secrets:
```bash
supabase secrets set --env-file supabase/.env
```

3. Enable the function in Supabase Dashboard

## Error Handling

The function includes comprehensive error handling for:
- Invalid event formats
- Database connection issues
- Discord API failures
- Missing permissions
- Rate limiting

## Security

- JWT verification (optional)
- Service role authentication
- Environment variable protection
- Request validation

## Monitoring

Monitor function performance through:
- Supabase Dashboard
- Function logs
- Discord notification delivery
- Database webhook processing

## Development Guidelines

### Adding New Event Types

1. Update the `MatchEvent` interface:
```typescript
interface MatchEvent {
  type: 'NEW_EVENT_TYPE' | // existing types...
  // ...
}
```

2. Add handling in `convertWebhookToMatchEvent`:
```typescript
if (newCondition) {
  return {
    type: 'NEW_EVENT_TYPE',
    matchId: payload.record.matchId,
    data: {
      // event specific data
    }
  };
}
```

3. Add case in `handleMatchEvent`:
```typescript
case 'NEW_EVENT_TYPE':
  notificationContent = // format notification
  // handle database updates
  break;
```

### Testing

Test your changes using the provided curl command or the Supabase Dashboard.

## Troubleshooting

Common issues and solutions:

1. Permission Denied
```sql
-- Run in SQL editor
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
```

2. Discord Notification Failures
- Verify bot token
- Check channel permissions
- Ensure bot is in the server

3. Database Webhook Issues
- Verify table triggers
- Check webhook URL
- Validate payload format

## Support

For issues:
1. Check Supabase logs
2. Review Discord API responses
3. Contact OneVOne support team

## Resources

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Discord API Documentation](https://discord.com/developers/docs)
- [Deno Runtime](https://deno.land/) 