# OneVOne Discord Bot

A Discord bot for managing OneVOne gaming platform matches and tournaments. This bot integrates with Ethereum smart contracts and provides a seamless interface for creating and managing blockchain-based gaming matches.

## Features

### Match Management
- `/create-match` - Create new matches with customizable types (1v1, 2v2, 5v5)
- `/match-info` - View detailed match information
- `/my-matches` - List all your created matches
- Automatic match channels creation and management
- Real-time match status updates
- Stake management in ETH

### Integration
- Seamless integration with OneVOne platform
- Ethereum smart contract interaction
- Prisma database integration
- Automatic Discord channel management

### User Experience
- Rich embeds for match information
- Pinned match details in dedicated channels
- Guided setup process for new matches
- Error handling and user feedback
- Wallet linking capabilities

## Prerequisites

- Python 3.9 or higher
- Poetry for dependency management
- PostgreSQL database
- Ethereum node access (Infura/Alchemy)
- Discord Bot Token
- Supabase account (for database)

## Environment Setup

1. Create a `.env` file in the root directory with the following variables:

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_guild_id
COMMAND_PREFIX=!

# Database Configuration
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_database_url

# Blockchain Configuration
RPC_URL=your_ethereum_rpc_url
CONTRACT_ADDRESS=your_contract_address

# Frontend Configuration
FRONTEND_URL=your_frontend_url

# Logging
LOG_LEVEL=INFO
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/onevone-discord-bot.git
cd onevone-discord-bot
```

2. Install dependencies using Poetry:
```bash
poetry install
```

3. Generate Prisma client:
```bash
poetry run prisma generate
```

4. Run database migrations:
```bash
poetry run prisma migrate deploy
```

5. Start the bot:
```bash
poetry run python -m src.bot.main
```

## Project Structure

```
discord-bot/
├── src/
│   ├── bot/
│   │   ├── cogs/           # Discord bot commands
│   │   │   ├── match/      # Match-related functionality
│   │   │   │   ├── cog.py  # Match cog implementation
│   │   │   │   ├── commands.py # Command handlers
│   │   │   │   ├── constants.py # Match constants
│   │   │   │   └── utils.py # Match utilities
│   │   └── main.py         # Bot initialization
│   ├── db/
│   │   └── prisma.py       # Database client
│   ├── web3/
│   │   └── contract.py     # Blockchain integration
│   └── utils/
│       ├── config.py       # Configuration management
│       └── embeds.py       # Discord embed templates
├── prisma/
│   └── schema.prisma       # Database schema
├── tests/                  # Test files
├── pyproject.toml         # Project dependencies
└── .env                   # Environment variables
```

## Development

### Code Style
The project uses Black and isort for code formatting:
```bash
# Format code
poetry run black .
poetry run isort .
```

### Testing
Run tests using pytest:
```bash
poetry run pytest
```

### Adding New Commands
1. Create a new cog in `src/bot/cogs/`
2. Register commands using `@app_commands.command()`
3. Add the cog to `setup_hook()` in `main.py`

## Deployment

1. Ensure all environment variables are set
2. Generate a fresh Prisma client
3. Run database migrations
4. Start the bot using a process manager (e.g., PM2, systemd)

## Error Handling

The bot includes comprehensive error handling:
- Database connection issues
- Smart contract interaction failures
- Discord API rate limits
- Invalid user inputs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support, please:
1. Check the documentation
2. Open an issue on GitHub
3. Contact the OneVOne team

## Security

- Never commit `.env` files
- Keep your Discord bot token secure
- Regularly update dependencies
- Monitor smart contract interactions
