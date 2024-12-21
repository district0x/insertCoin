# Twitter Integration Edge Functions

This directory contains Edge Functions for Twitter integration with the OneVOne platform.

## Structure

```
functions/
├── twitter-matches/      # Handles match events
├── twitter-tournaments/  # Handles tournament events
├── twitter-daily-stats/  # Handles daily stats
└── utils/               # Shared utilities
    └── twitter.ts       # Twitter API client
```

## Setup

1. Install dependencies:

```bash
cd supabase/functions
npm install twitter-api-v2 @supabase/supabase-js
```

2. Set up environment variables in Supabase:

```bash
supabase secrets set TWITTER_API_KEY=your_api_key
supabase secrets set TWITTER_API_SECRET=your_api_secret
supabase secrets set TWITTER_ACCESS_TOKEN=your_access_token
supabase secrets set TWITTER_ACCESS_SECRET=your_access_secret
```

3. Create Database Webhook for matches:

```sql
create trigger on_match_change
  after insert or update on matches
  for each row execute function http_request('https://your-project.functions.supabase.co/twitter-matches');
```

4. Create Database Webhook for tournaments:

```sql
create trigger on_tournament_change
  after insert on tournaments
  for each row execute function http_request('https://your-project.functions.supabase.co/twitter-tournaments');
```

## Features

1. Match Events:

   - Posts when a new match is created
   - Posts when a player joins a match
   - Includes game, platform, and prize details

2. Tournament Events:

   - Posts when a new tournament is created
   - Includes game, prize pool, and player count

3. Daily Stats:
   - Automatically posts daily statistics
   - Includes total matches, prize pool, and top player

## Development

1. Local testing:

```bash
supabase functions serve
```

2. Deployment:

```bash
supabase functions deploy
```

## Error Handling

All events are logged in the `twitter_posts` table with their status and any error messages.

## Rate Limiting

Twitter API rate limits are handled automatically by the twitter-api-v2 library.
