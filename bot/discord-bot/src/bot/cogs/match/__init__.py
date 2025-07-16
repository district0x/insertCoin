"""Match cog for handling match-related commands."""

from .cog import MatchCog

async def setup(bot):
    """Set up the match cog."""
    await bot.add_cog(MatchCog(bot)) 