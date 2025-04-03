# Twitter Events Function

This Supabase Edge Function posts tweets whenever significant match events occur in the OneVOne platform.

## Events Supported

- **Match Created**: When a match's status changes from PENDING to OPEN
- **Match Joined**: When a match's status changes from OPEN to FILLED
- **Match Completed**: When a match's status changes to COMPLETED

## Environment Variables

The following environment variables need to be set in your Supabase project:

```
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret
```

## Development

1. Setup local development environment:

```bash
supabase functions serve twitter-events --env-file supabase/.env
```

2. Test the function with a sample payload:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/twitter-events' \
--header 'Content-Type: application/json' \
--data '{
  "type": "UPDATE",
  "source": "Match",
  "record": {
    "matchId": 123,
    "matchType": "1V1",
    "status": "OPEN",
    "old_status": "PENDING",
    "stake": 10
  }
}'
```

## Deployment

```bash
supabase functions deploy twitter-events
```

## Database Setup

The function uses a `TwitterPosts` table to track tweets. Create this table with the following SQL:

```sql
create table if not exists "TwitterPosts" (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  reference_id text not null,
  tweet_id text,
  status text not null,
  error_message text,
  created_at timestamp with time zone default now() not null
);

-- Create indexes for faster lookups
create index if not exists "TwitterPosts_type_idx" on "TwitterPosts" (type);
create index if not exists "TwitterPosts_reference_id_idx" on "TwitterPosts" (reference_id);
```

## Webhook Setup

Configure a webhook in Supabase to trigger this function when match events occur:

1. Go to Database → Webhooks in your Supabase dashboard
2. Create a new webhook:
   - HTTP Method: POST
   - URL: https://your-project-ref.supabase.co/functions/v1/twitter-events
   - Table: Match
   - Events: UPDATE (for status changes)
   - Headers: Content-type: application/json
   - Select payloads to include: old record, new record 