import logging
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from src.db.prisma import prisma
from src.web3.contract import contract
from src.utils.embeds import create_stats_embed, create_match_history_embed, create_opponent_record_embed
from src.utils.rate_limiter import get_rate_limit_stats, METRICS

logger = logging.getLogger(__name__)

class UtilsCog(commands.Cog):
    """Utility commands for the bot."""
    
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        super().__init__()
        
    @app_commands.command(name="link-wallet")
    async def link_wallet(self, interaction: discord.Interaction):
        """Link your wallet to Discord via our secure website."""
        await interaction.response.defer()
        
        try:
            # Get frontend URL from config
            from src.utils.config import config
            frontend_url = config.get_frontend_url("link-wallet")
            
            embed = discord.Embed(
                title="🔗 Link Your Wallet to Discord",
                description="Visit our secure website to connect your wallet to Discord for match creation and statistics tracking.",
                color=discord.Color.blue()
            )
            
            embed.add_field(
                name="🌐 Secure Linking",
                value=f"[**Click here to link your wallet**]({frontend_url})",
                inline=False
            )
            
            embed.add_field(
                name="✅ Supported Methods",
                value=(
                    "• **Gmail** - Automatic wallet creation (no crypto knowledge needed)\n"
                    "• **Discord** - Direct linking with your Discord account\n"
                    "• **Google** - Automatic wallet creation\n"
                    "• **Traditional Wallets** - MetaMask, Trust Wallet, Coinbase Wallet, etc."
                ),
                inline=False
            )
            
            embed.add_field(
                name="🚀 How It Works",
                value=(
                    "1. Click the link above\n"
                    "2. Connect with your preferred method\n"
                    "3. Your wallet and Discord are automatically linked\n"
                    "4. Use `/profile` to verify your connection\n"
                    "5. Start creating matches with `/create-match`"
                ),
                inline=False
            )
            
            embed.add_field(
                name="💡 Benefits",
                value=(
                    "• **Secure Match Creation** - Create matches directly from Discord\n"
                    "• **Track Your Stats** - View match history and statistics\n"
                    "• **Fair Play** - Prevents multi-accounting\n"
                    "• **Easy Setup** - Works with any wallet type"
                ),
                inline=False
            )
            
            embed.set_footer(text="🔒 Your wallet connection is secure and private")
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error in link wallet command: {e}", exc_info=True)
            await interaction.followup.send(
                "❌ An error occurred. Please try again or contact support.",
                ephemeral=True
            )

    @app_commands.command(name="profile")
    async def profile(self, interaction: discord.Interaction):
        """View your gaming profile and statistics."""
        await interaction.response.defer()
        
        try:
            # Get user stats
            user = await prisma.user.find_unique(
                where={"discordId": str(interaction.user.id)}
            )
            
            if not user:
                embed = discord.Embed(
                    title="👤 Profile Not Found",
                    description="You don't have a profile yet. Create a match to get started!",
                    color=discord.Color.orange()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            # Calculate win rate
            total_matches = user.totalMatches
            win_rate = (user.totalWins / total_matches * 100) if total_matches > 0 else 0
            
            embed = discord.Embed(
                title=f"👤 {interaction.user.display_name}'s Profile",
                description="Your gaming statistics and achievements",
                color=discord.Color.blue()
            )
            
            # Stats Section
            embed.add_field(
                name="📊 Statistics",
                value=(
                    f"**Total Matches:** {total_matches}\n"
                    f"**Wins:** {user.totalWins}\n"
                    f"**Losses:** {user.totalLosses}\n"
                    f"**Win Rate:** {win_rate:.1f}%"
                ),
                inline=True
            )
            
            # Wallet Info
            if user.address:
                embed.add_field(
                    name="💳 Wallet",
                    value=f"`{user.address[:8]}...{user.address[-6:]}`",
                    inline=True
                )
            else:
                embed.add_field(
                    name="💳 Wallet",
                    value="Not linked",
                    inline=True
                )
            
            # Recent Activity
            recent_matches = await prisma.match.findMany(
                where={
                    "OR": [
                        {"creatorDiscordId": str(interaction.user.id)},
                        {"opponentDiscordId": str(interaction.user.id)}
                    ]
                },
                orderBy={"createdAt": "desc"},
                take=5
            )
            
            if recent_matches:
                recent_text = "\n".join([
                    f"• {match.matchType} - {match.status} ({match.createdAt.strftime('%m/%d')})"
                    for match in recent_matches
                ])
                embed.add_field(
                    name="🕒 Recent Activity",
                    value=recent_text,
                    inline=False
                )
            
            embed.add_field(
                name="💡 Getting Started",
                value=(
                    "1. Use `/link-wallet` to connect your wallet to Discord\n"
                    "2. Use `/create-match` to start a new game\n"
                    "3. Use `/profile` to view your stats\n"
                    "4. Have fun playing!"
                ),
                inline=False
            )
            
            embed.add_field(
                name="🔗 Wallet Linking",
                value=(
                    "**New users:** Use `/link-wallet` to visit our secure website\n"
                    "**Supports:** Gmail, Discord, Google, and traditional wallets\n"
                    "**No crypto knowledge needed** - Gmail users get automatic wallets!"
                ),
                inline=False
            )
            
            embed.set_footer(text="Need more help? Ask in the support channel!")
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error getting profile: {e}", exc_info=True)
            await interaction.followup.send(
                "An error occurred while getting your profile. Please try again.",
                ephemeral=True
            )

    @app_commands.command(name="rate-limits")
    @app_commands.default_permissions(administrator=True)
    async def rate_limits(self, interaction: discord.Interaction):
        """View rate limiting statistics (Admin only)."""
        await get_rate_limit_stats(interaction)

    @app_commands.command(name="help")
    async def help_command(self, interaction: discord.Interaction):
        """Get help with bot commands."""
        embed = discord.Embed(
            title="🤖 OneVOne Bot Help",
            description="Here are all the available commands:",
            color=discord.Color.blue()
        )
        
        # Match Commands
        embed.add_field(
            name="🎮 Match Commands",
            value=(
                "`/create-match` - Create a new match\n"
                "`/match-info <room_id>` - Get match details\n"
                "`/stats` - View your statistics\n"
                "`/matchhistory` - View your match history\n"
                "`/opponents <user>` - Check record against opponent"
            ),
            inline=False
        )
        
        # Profile Commands
        embed.add_field(
            name="👤 Profile Commands",
            value=(
                "`/profile` - View your gaming profile\n"
                "`/link-wallet <address>` - Link your wallet\n"
                "`/unlink-wallet` - Unlink your wallet\n"
                "`/wallet-info` - View wallet details"
            ),
            inline=False
        )
        
        # Admin Commands
        embed.add_field(
            name="⚙️ Admin Commands",
            value=(
                "`/rate-limits` - View rate limiting stats\n"
                "`/help` - Show this help message"
            ),
            inline=False
        )
        
        embed.add_field(
            name="💡 Tips",
            value=(
                "• Use `/create-match` to start a new game\n"
                "• Link your wallet to track statistics\n"
                "• Join match rooms to coordinate with opponents\n"
                "• Check your profile regularly for updates"
            ),
            inline=False
        )
        
        embed.set_footer(text="Need more help? Ask in the support channel!")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(UtilsCog(bot))

