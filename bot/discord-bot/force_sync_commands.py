#!/usr/bin/env python3
"""
Script to force clear and re-sync Discord commands.
This will completely refresh Discord's command cache.
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

async def force_sync_commands():
    """Force clear and re-sync commands with Discord."""
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
        logger.info('Cogs loaded')
        
        # Force clear all commands first
        guild_id = os.getenv('DISCORD_GUILD_ID')
        if guild_id:
            guild = discord.Object(id=int(guild_id))
            logger.info(f'Clearing all commands from guild {guild_id}')
            bot.tree.clear_commands(guild=guild)
            await bot.tree.sync(guild=guild)
            logger.info('Commands cleared')
            
            # Now sync the new commands
            logger.info(f'Syncing new commands to guild {guild_id}')
            await bot.tree.sync(guild=guild)
        else:
            logger.info('Clearing all global commands')
            bot.tree.clear_commands()
            await bot.tree.sync()
            logger.info('Commands cleared')
            
            # Now sync the new commands globally
            logger.info('Syncing new commands globally')
            await bot.tree.sync()
        
        logger.info('✅ Commands force synced successfully!')
        await bot.close()

    await bot.start(os.getenv('DISCORD_TOKEN'))

if __name__ == '__main__':
    asyncio.run(force_sync_commands()) 