import os
import logging
from pathlib import Path

import discord
from discord.ext import commands
from dotenv import load_dotenv

from src.db.prisma import prisma
from src.web3_contracts.contract import contract
from src.utils.config import config

# Import health server
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from health_server import start_health_server, stop_health_server

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
        # Start health check server
        await start_health_server()
        logger.info("Health check server started")
        
        # Initialize database connection with proper connection string FIRST
        prisma.connect(config.DATABASE_URL)
        logger.info("Database connection initialized")
        
        # Initialize blockchain connection
        try:
            contract.connect()
            logger.info("Blockchain connection initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize blockchain connection: {e}")
            logger.warning("Bot will continue with limited functionality (no blockchain features)")
        
        # Load cogs AFTER database is connected
        await self.load_extension('src.bot.cogs.match')
        await self.load_extension('src.bot.cogs.utils')
        await self.load_extension('src.bot.cogs.admin')
        # Removed wallet_verification cog - wallet linking system removed
        logger.info('Bot cogs loaded successfully')
        
        # Set up event listeners for new channels (Banned role permissions)
        @self.event
        async def on_guild_channel_create(channel):
            """Automatically apply Banned role permissions to new channels."""
            try:
                if isinstance(channel, (discord.TextChannel, discord.VoiceChannel)):
                    banned_role = discord.utils.get(channel.guild.roles, name="Banned")
                    if banned_role:
                        await channel.set_permissions(banned_role, 
                            read_messages=False,
                            send_messages=False,
                            connect=False,
                            speak=False
                        )
                        logger.info(f"Applied Banned role permissions to new channel: {channel.name}")
            except Exception as e:
                logger.warning(f"Could not apply Banned role to new channel {channel.name}: {e}")
        
        # Sync commands with Discord
        try:
            guild_id = os.getenv('DISCORD_GUILD_ID')
            if guild_id:
                guild = discord.Object(id=int(guild_id))
                # This copies the global commands over to your guild.
                self.tree.copy_global_to(guild=guild)
                await self.tree.sync(guild=guild)
                logger.info(f'Command tree synced with guild {guild_id}')
            else:
                # If no guild ID is provided, sync commands globally
                await self.tree.sync()
                logger.info('Command tree synced globally')
        except discord.Forbidden:
            logger.warning("Missing permissions to sync commands. Please re-invite bot with 'applications.commands' scope.")
            logger.warning("Bot will continue but slash commands may not work.")
        except Exception as e:
            logger.error(f"Failed to sync commands: {e}")
            logger.warning("Bot will continue but slash commands may not work.")
        
    async def on_ready(self):
        """Event that runs when the bot is ready."""
        logger.info(f'Logged in as {self.user.name} ({self.user.id})')
        logger.info('------')
        
    async def close(self):
        """Cleanup when the bot is shutting down."""
        # Stop health check server
        await stop_health_server()
        logger.info("Health check server stopped")
        
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
