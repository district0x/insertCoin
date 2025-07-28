"""Match cog implementation."""

import logging
from typing import Optional, List

import discord
from discord import app_commands
from discord.ext import commands

from .constants import GAME_CHOICES, PLATFORM_CHOICES, MATCH_TYPES, TOKEN_CHOICES
from .commands import (
    handle_create_match,
    handle_match_info,
    handle_stats,
    handle_match_history,
    handle_opponents,
    get_game_choices
)

logger = logging.getLogger(__name__)

class MatchCog(commands.Cog, name="Match"):
    """Cog for handling match-related commands."""
    
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        super().__init__()

    @app_commands.command(name="create-match")
    @app_commands.describe(
        match_type="Type of match",
        platform="Choose your platform",
        category="Choose the game category",
        game="Choose the game",
        match_amount_usd="Enter the match amount in USD",
        token_type="Choose token type for the match",
        amount="Stake amount in selected token (optional)"
    )
    @app_commands.choices(
        match_type=[
            app_commands.Choice(name=name, value=value)
            for name, value in MATCH_TYPES
        ],
        platform=[
            app_commands.Choice(name=name, value=value)
            for name, value in PLATFORM_CHOICES
        ],
        category=[
            app_commands.Choice(name=cat, value=cat)
            for cat in GAME_CHOICES.keys()
        ],
        token_type=[
            app_commands.Choice(name=name, value=value)
            for name, value in TOKEN_CHOICES
        ]
    )
    async def create_match(
        self,
        interaction: discord.Interaction,
        match_type: str,
        platform: str,
        category: str,
        game: str,
        match_amount_usd: int,
        token_type: str,
        amount: Optional[float] = None
    ):
        """Create a new match."""
        await handle_create_match(
            interaction,
            self.bot,
            match_type,
            platform,
            category,
            game,
            match_amount_usd,
            token_type,
            amount
        )

    @app_commands.command(name="match-info")
    @app_commands.describe(room_id="Room ID of the match to get info about")
    async def match_info(
        self,
        interaction: discord.Interaction,
        room_id: str
    ):
        """Get information about a specific match."""
        await handle_match_info(interaction, self.bot, room_id)

    @app_commands.command(name="stats")
    async def stats(self, interaction: discord.Interaction):
        """View your gaming statistics."""
        await handle_stats(interaction, self.bot)

    @app_commands.command(name="matchhistory")
    async def match_history(self, interaction: discord.Interaction):
        """View your recent matches."""
        await handle_match_history(interaction, self.bot)

    @app_commands.command(name="opponents")
    @app_commands.describe(opponent="Discord user to check record against")
    async def opponents(
        self,
        interaction: discord.Interaction,
        opponent: discord.User
    ):
        """View your record against specific opponents."""
        await handle_opponents(interaction, self.bot, opponent)

    @create_match.autocomplete("game")
    async def game_autocomplete(
        self,
        interaction: discord.Interaction,
        current: str,
    ) -> List[app_commands.Choice[str]]:
        """Autocomplete for game choices."""
        return await get_game_choices(interaction, current) 