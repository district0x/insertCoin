import os
import logging
from pathlib import Path

import discord
from discord.ext import commands
from dotenv import load_dotenv

from src.db.prisma import prisma
from src.web3.contract import contract
from src.utils.config import config

# Load environment variables
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Bot configuration
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

class OneVOneBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix=os.getenv('COMMAND_PREFIX', '!'),
            intents=intents,
            help_command=None
        )
        
    async def setup_hook(self):
        """Setup hook that runs when the bot starts."""
        # Initialize database connection with proper connection string FIRST
        prisma.connect(config.DATABASE_URL)
        logger.info("Database connection initialized")
        
        # Initialize blockchain connection
        contract.connect()
        logger.info("Blockchain connection initialized")
        
        # Load cogs AFTER database is connected
        await self.load_extension('src.bot.cogs.match')
        await self.load_extension('src.bot.cogs.utils')
        # Removed wallet_verification cog - wallet linking system removed
        logger.info('Bot cogs loaded successfully')
        
        # Sync commands with Discord
        guild_id = os.getenv('DISCORD_GUILD_ID')
        if guild_id:
            guild = discord.Object(id=int(guild_id))
            # This copies the global commands over to your guild.
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            # If no guild ID is provided, sync commands globally
            await self.tree.sync()
        logger.info('Command tree synced with Discord')
        
    async def on_ready(self):
        """Event that runs when the bot is ready."""
        logger.info(f'Logged in as {self.user.name} ({self.user.id})')
        logger.info('------')
        
    async def close(self):
        """Cleanup when the bot is shutting down."""
        prisma.disconnect()
        logger.info("Database connection closed")
        await super().close()

async def main():
    """Main function to run the bot."""
    async with OneVOneBot() as bot:
        await bot.start(os.getenv('DISCORD_TOKEN'))

if __name__ == '__main__':
    import asyncio
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info('Bot shutdown by user')
    except Exception as e:
        logger.error(f'Bot error: {e}', exc_info=True)
