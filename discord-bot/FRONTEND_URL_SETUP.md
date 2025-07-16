# Frontend URL Configuration for Vercel Deployment

## Problem
Your Discord bot is currently configured to generate match URLs pointing to `localhost:3000`, but your frontend is now deployed on Vercel at `https://insert-coin-v136.vercel.app`.

## Solution
You need to update the `FRONTEND_URL` environment variable in your bot's configuration.

### Step 1: Create/Update .env file

Create a `.env` file in the `bot/discord-bot/` directory with the following content:

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_token_here
DISCORD_GUILD_ID=your_guild_id_here

# Database Configuration
DATABASE_URL=your_supabase_database_url_here
DIRECT_URL=your_supabase_direct_url_here

# Web3 Configuration
RPC_URL=your_rpc_url_here
CONTRACT_ADDRESS=your_contract_address_here

# Frontend URL (Vercel deployment)
FRONTEND_URL=https://insert-coin-v136.vercel.app

# Logging
LOG_LEVEL=INFO
```

### Step 2: Update your existing .env file

If you already have a `.env` file, simply update the `FRONTEND_URL` line:

```bash
# Change this line in your existing .env file:
FRONTEND_URL=https://insert-coin-v136.vercel.app
```

### Step 3: Restart the bot

After updating the environment variable, restart your Discord bot:

```bash
# If using PM2:
pm2 restart insertcoin-bot

# If running directly:
python -m src.bot.main
```

## How it works

The bot uses the `config.get_frontend_url()` method in `src/utils/config.py` to generate URLs. This method combines the `FRONTEND_URL` with the match path:

- **Before**: `http://localhost:3000/matches/98`
- **After**: `https://insert-coin-v136.vercel.app/matches/98`

## Verification

After making this change, when you create a match through the Discord bot, the generated URLs will point to your Vercel deployment instead of localhost.

## Example URLs

With the correct configuration, your bot will generate URLs like:
- Match creation: `https://insert-coin-v136.vercel.app/matches/create?roomId=123&discord=true&amount=10&ethAmount=0.005`
- Match viewing: `https://insert-coin-v136.vercel.app/matches/98` 