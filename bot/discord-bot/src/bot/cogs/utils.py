import logging
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from src.db.prisma import prisma
from src.web3.contract import contract

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
        """View your profile and match statistics."""
        await interaction.response.defer()
        
        try:
            # Find user by Discord ID
            user = prisma.user.find_unique(
                where={"discordId": str(interaction.user.id)}
            )
            
            if not user:
                embed = discord.Embed(
                    title="👤 Profile Not Found",
                    description="You don't have a profile yet. Create a match to get started!",
                    color=discord.Color.blue()
                )
                embed.add_field(
                    name="Get Started",
                    value="Use `/create-match` to start a new match and create your profile.",
                    inline=False
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
                
            # Calculate win rate
            total_matches = user.totalMatches
            wins = user.totalWins
            losses = user.totalLosses
            win_rate = (wins / total_matches * 100) if total_matches > 0 else 0
            
            # Create profile embed
            embed = discord.Embed(
                title=f"👤 {interaction.user.display_name}'s Profile",
                color=discord.Color.blue()
            )
            
            if user.address:
                embed.add_field(
                    name="🔗 Linked Wallet",
                    value=f"`{user.address[:6]}...{user.address[-4:]}`",
                    inline=True
                )
            
            embed.add_field(
                name="📊 Match Statistics",
                value=(
                    f"**Total Matches:** {total_matches}\n"
                    f"**Wins:** {wins}\n"
                    f"**Losses:** {losses}\n"
                    f"**Win Rate:** {win_rate:.1f}%"
                ),
                inline=True
            )
            
            # Add recent activity - query through User table to get matches they participated in
            recent_matches = prisma.match.find_many(
                where={
                    "OR": [
                        {"creatorId": user.id},
                        {"participants": {"some": {"id": user.id}}}
                    ]
                },
                order={"createdAt": "desc"},
                take=5
            )
            
            if recent_matches:
                recent_activity = []
                for match in recent_matches:
                    status_emoji = {
                        "PENDING": "⏳",
                        "OPEN": "🔓",
                        "FILLED": "✅",
                        "COMPLETED": "🏆",
                        "CANCELLED": "❌"
                    }.get(match.status, "❓")
                    
                    recent_activity.append(
                        f"{status_emoji} Match #{match.matchId} ({match.matchType.replace('_', ' ').title()})"
                    )
                
                embed.add_field(
                    name="📈 Recent Activity",
                    value="\n".join(recent_activity),
                    inline=False
                )
            
            embed.set_footer(text=f"Profile last updated: {discord.utils.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error fetching profile: {e}", exc_info=True)
            await interaction.followup.send(
                "❌ An error occurred while fetching your profile. Please try again or contact support.",
                ephemeral=True
            )
            
    @app_commands.command(name="help")
    async def help_command(self, interaction: discord.Interaction):
        """Show help information about available commands."""
        embed = discord.Embed(
            title="🎮 OneVOne Bot Commands",
            description="Here are all the available commands:",
            color=discord.Color.blue()
        )
        
        # Wallet commands
        embed.add_field(
            name="🔗 Wallet Commands",
            value=(
                "`/link-wallet` - Link your wallet to Discord (via website)\n"
                "`/profile` - View your profile and statistics"
            ),
            inline=False
        )
        
        # Match commands
        embed.add_field(
            name="🎯 Match Commands",
            value=(
                "`/create-match` - Create a new match\n"
                "`/match-info <id>` - Get info about a specific match\n"
                "`/stats` - View your gaming statistics\n"
                "`/matchhistory` - View your recent matches\n"
                "`/opponents <user>` - Check your record against someone"
            ),
            inline=False
        )
        
        # Profile commands
        embed.add_field(
            name="👤 Profile Commands",
            value=(
                "`/profile` - View your profile and statistics\n"
                "`/help` - Show this help message"
            ),
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
        
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(UtilsCog(bot))

