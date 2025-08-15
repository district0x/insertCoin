"""Admin cog for handling administrative commands."""

from .cog import AdminCog
 
async def setup(bot):
    """Set up the admin cog."""
    await bot.add_cog(AdminCog(bot)) 