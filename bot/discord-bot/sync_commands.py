#!/usr/bin/env python3
"""
Script to force sync Discord commands.
This will update Discord with the new command signatures including the token_type parameter.
"""

import asyncio
import os
import logging
from pathlib import Path

import discord
from discord.ext import commands
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def sync_commands():
    """Force sync commands with Discord."""
    intents = discord.Intents.default()
    intents.message_content = True
    intents.members = True
    
    bot = commands.Bot(command_prefix='!', intents=intents)
    
    @bot.event
    async def on_ready():
        logger.info(f'Logged in as {bot.user.name} ({bot.user.id})')
        
        # Load the match cog
        await bot.load_extension('src.bot.cogs.match')
        await bot.load_extension('src.bot.cogs.utils')
        await bot.load_extension('src.bot.cogs.admin')
        logger.info('Cogs loaded')
        
        # Sync commands
        guild_id = os.getenv('DISCORD_GUILD_ID')
        if guild_id:
            guild = discord.Object(id=int(guild_id))
            logger.info(f'Syncing commands to guild {guild_id}')
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
        else:
            logger.info('Syncing commands globally')
            await bot.tree.sync()
        
        logger.info('✅ Commands synced successfully!')
        await bot.close()

    await bot.start(os.getenv('DISCORD_TOKEN'))

if __name__ == '__main__':
    asyncio.run(sync_commands()) 