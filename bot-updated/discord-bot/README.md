# OneVOne Discord Bot

A Discord bot for managing OneVOne platform matches and tournaments.

## Features

- Match creation and management
- Tournament integration
- Wallet linking
- Real-time match updates
- Team management

## Setup

1. Install dependencies:
```bash
poetry install
```

2. Create `.env` file with required environment variables:
```bash
DISCORD_TOKEN=your_discord_bot_token
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_database_url
RPC_URL=your_ethereum_rpc_url
CONTRACT_ADDRESS=your_contract_address
FRONTEND_URL=your_frontend_url
```

3. Generate Prisma client:
```bash
poetry run prisma generate
```

4. Run the bot:
```bash
poetry run python -m src.bot.main
```

## Development

- Format code:
```bash
poetry run black .
poetry run isort .
```

- Run tests:
```bash
poetry run pytest
```

## Project Structure

```
discord-bot/
├── pyproject.toml        # Poetry dependencies
├── .env                  # Environment variables
├── README.md            # Documentation
└── src/
    ├── bot/             # Discord bot code
    ├── db/              # Database integration
    ├── web3/            # Blockchain integration
    └── utils/           # Utility functions
```

## License

MIT
