"""Command handlers for match-related functionality."""

import logging
from typing import Optional, List

import discord
from discord import app_commands

from .constants import GAME_CHOICES
from .utils import (
    create_match_channel,
    create_match_in_db,
    create_match_embeds,
    get_match_info,
    get_match_history,
    get_opponent_record,
    get_user_stats,
)
from src.utils.embeds import (
    create_match_embed,
    create_match_info_embed,
    create_stats_embed,
    create_match_history_embed,
    create_opponent_record_embed,
)
from src.utils.rate_limiter import (
    rate_limit,
    DISCORD_RATE_LIMITER,
    DiscordRateLimitHandler,
    rate_limited_discord_operation,
    rate_limited_db_operation
)

logger = logging.getLogger(__name__)

@rate_limit(DISCORD_RATE_LIMITER, user_specific=True)
async def handle_create_match(
    interaction: discord.Interaction,
    bot,
    match_type: str,
    platform: str,
    category: str,
    game: str,
    match_amount_usd: int,
    amount: Optional[float] = None
):
    """Handle the create-match command with rate limiting."""
    await interaction.response.defer()
    
    try:
        logger.info(f"Creating match with type: {match_type}, platform: {platform}, game: {game}, amount: {amount}")
        
        # Prepare match data for channel creation
        match_data = {
            "matchType": match_type,
            "platform": platform,
            "game": game,
            "matchAmountUsd": match_amount_usd
        }
        
        # Create match channel with rate limiting
        async def create_channel():
            return await create_match_channel(interaction, match_data)
        
        channel_info = await DiscordRateLimitHandler.handle_rate_limit(
            interaction, create_channel
        )

        # Create match in database with rate limiting
        async def create_db_match():
            return await create_match_in_db(
                interaction,
                match_type,
                platform,
                category,
                game,
                match_amount_usd,
                amount,
                channel_info
            )
        
        match = await rate_limited_db_operation(create_db_match)

        # Create and send embeds with rate limiting
        async def send_embeds():
            await create_match_embeds(interaction, match, channel_info)
        
        await DiscordRateLimitHandler.handle_rate_limit(
            interaction, send_embeds
        )

        # Send success message
        await rate_limited_discord_operation(
            interaction.followup.send,
            f"✅ Match created successfully! Head over to {channel_info.channel.mention} to get started.",
            ephemeral=True
        )
        
        logger.info("Match creation completed successfully")
        
    except Exception as e:
        logger.error(f"Error creating match: {e}", exc_info=True)
        await rate_limited_discord_operation(
            interaction.followup.send,
            "An error occurred while creating the match. Please try again.",
            ephemeral=True
        )

async def handle_match_info(
    interaction: discord.Interaction,
    bot,
    room_id: str
):
    """Handle the match-info command."""
    await interaction.response.defer()
    
    try:
        logger.info(f"Handling match info request for Room ID: {room_id}")
        match = await get_match_info(room_id)
        
        if not match:
            await interaction.followup.send(
                f"Match with Room ID {room_id} not found. Please check the Room ID and try again.",
                ephemeral=True
            )
            return
            
        try:
            creator = await bot.fetch_user(int(match.creatorDiscordId))
        except Exception as e:
            logger.error(f"Error fetching creator user: {e}", exc_info=True)
            creator = None
            
        if not creator:
            await interaction.followup.send(
                "Could not find the match creator. The match data might be corrupted.",
                ephemeral=True
            )
            return
            
        # Use create_match_info_embed for viewing match details
        embed = create_match_info_embed(match, creator)
        await interaction.followup.send(embed=embed)
        logger.info(f"Successfully sent match info for Room ID {room_id}")
        
    except Exception as e:
        logger.error(f"Error handling match info: {e}", exc_info=True)
        await interaction.followup.send(
            "An error occurred while getting match info. Please try again.",
            ephemeral=True
        )

async def handle_stats(interaction: discord.Interaction, bot):
    """Handle the stats command."""
    await interaction.response.defer()
    
    try:
        stats = await get_user_stats(interaction.user.id)
        if not stats:
            await interaction.followup.send(
                "You haven't played any matches yet.",
                ephemeral=True
            )
            return
            
        embed = create_stats_embed(stats)
        await interaction.followup.send(embed=embed)
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}", exc_info=True)
        await interaction.followup.send(
            "An error occurred while getting your stats. Please try again.",
            ephemeral=True
        )

async def handle_match_history(interaction: discord.Interaction, bot):
    """Handle the matchhistory command."""
    await interaction.response.defer()
    
    try:
        history = await get_match_history(interaction.user.id, bot)
        if not history:
            await interaction.followup.send(
                "You haven't played any matches yet.",
                ephemeral=True
            )
            return
            
        embed = create_match_history_embed(history)
        await interaction.followup.send(embed=embed)
        
    except Exception as e:
        logger.error(f"Error getting match history: {e}", exc_info=True)
        await interaction.followup.send(
            "An error occurred while getting your match history. Please try again.",
            ephemeral=True
        )

async def handle_opponents(
    interaction: discord.Interaction,
    bot,
    opponent: discord.User
):
    """Handle the opponents command."""
    await interaction.response.defer()
    
    try:
        record = await get_opponent_record(interaction.user.id, opponent.id)
        if not record:
            await interaction.followup.send(
                f"You haven't played any matches against {opponent.name} yet.",
                ephemeral=True
            )
            return
            
        embed = create_opponent_record_embed(record, opponent)
        await interaction.followup.send(embed=embed)
        
    except Exception as e:
        logger.error(f"Error getting opponent record: {e}", exc_info=True)
        await interaction.followup.send(
            "An error occurred while getting your opponent record. Please try again.",
            ephemeral=True
        )

async def get_game_choices(
    interaction: discord.Interaction,
    current: str,
) -> List[app_commands.Choice[str]]:
    """Get game choices for autocomplete."""
    category = interaction.namespace.category
    if not category:
        return []
    
    games = GAME_CHOICES.get(category, [])
    return [
        app_commands.Choice(name=game, value=game)
        for game in games
        if current.lower() in game.lower()
    ] 