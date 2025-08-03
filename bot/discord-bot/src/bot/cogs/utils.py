import logging
import re
from typing import Optional
from datetime import datetime, timedelta

import discord
from discord import app_commands
from discord.ext import commands

from src.db.prisma import prisma
from src.web3_contracts.contract import contract
from src.utils.embeds import create_stats_embed, create_match_history_embed, create_opponent_record_embed
from src.utils.rate_limiter import get_rate_limit_stats, METRICS

logger = logging.getLogger(__name__)

# Rate limiting storage for username changes
username_change_cooldowns = {}

def safe_db_query(query_func, *args, **kwargs):
    """Safely execute database queries."""
    try:
        return query_func(*args, **kwargs)
    except Exception as e:
        logger.error(f"Database query error: {e}")
        raise

def check_username_cooldown(user_id: str) -> tuple[bool, Optional[timedelta]]:
    """Check if user can change username (3-day cooldown)."""
    now = datetime.now()
    if user_id in username_change_cooldowns:
        last_change = username_change_cooldowns[user_id]
        time_since_change = now - last_change
        cooldown_duration = timedelta(days=3)
        
        if time_since_change < cooldown_duration:
            remaining_time = cooldown_duration - time_since_change
            return False, remaining_time
    
    return True, None

def update_username_cooldown(user_id: str):
    """Update the cooldown timestamp for a user."""
    username_change_cooldowns[user_id] = datetime.now()

def debug_prisma_models():
    """Debug function to check available Prisma models."""
    try:
        # Try to access different model names
        models_to_check = [
            'playerMatchup', 'player_matchup', 'PlayerMatchup',
            'playerTeamStats', 'player_team_stats', 'PlayerTeamStats',
            'teamMatchup', 'team_matchup', 'TeamMatchup'
        ]
        
        available_models = []
        for model_name in models_to_check:
            try:
                if hasattr(prisma, model_name):
                    available_models.append(model_name)
            except:
                pass
        
        logger.info(f"Available Prisma models: {available_models}")
        return available_models
    except Exception as e:
        logger.error(f"Error checking Prisma models: {e}")
        return []

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
            # Get user stats with all fields
            user = safe_db_query(
                prisma.user.find_unique,
                where={"discordId": str(interaction.user.id)}
            )
            
            if not user:
                embed = discord.Embed(
                    title="👤 Profile Not Found",
                    description="You don't have a profile yet. Use `/link-wallet` to get started!",
                    color=discord.Color.orange()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            # Calculate win rate
            total_matches = user.totalMatches or 0
            total_wins = user.totalWins or 0
            total_losses = user.totalLosses or 0
            # eth_earned = user.ethEarned or 0
            # match_tokens_earned = user.matchTokensEarned or 0
            
            win_rate = (total_wins / total_matches * 100) if total_matches > 0 else 0
            
            embed = discord.Embed(
                title=f"👤 {user.username or interaction.user.display_name}'s Profile",
                description="Your gaming statistics and achievements",
                color=discord.Color.blue()
            )
            
            # Player Info Section
            embed.add_field(
                name="👤 Player Info",
                value=(
                    f"**Player Name:** {user.username or 'Not set'}\n"
                    f"**Discord:** {interaction.user.display_name}\n"
                    f"**Wallet:** {user.address[:6]}...{user.address[-4:] if user.address else 'Not linked'}"
                ),
                inline=False
            )
            
            # Stats Section
            embed.add_field(
                name="📊 Match Statistics",
                value=(
                    f"**Total Matches:** {total_matches}\n"
                    f"**Wins:** {total_wins}\n"
                    f"**Losses:** {total_losses}\n"
                    f"**Win Rate:** {win_rate:.1f}%"
                ),
                inline=True
            )
            
            # Earnings Section
            # embed.add_field(
            #     name="💰 Earnings",
            #     value=(
            #         f"**ETH Earned:** {eth_earned:.4f} ETH\n"
            #         f"**MATCH Tokens:** {match_tokens_earned:.2f} MATCH"
            #     ),
            #     inline=True
            # )
            
            # Recent Activity
            try:
                recent_matches = prisma.match.findMany(
                    where={
                        "OR": [
                            {"creatorDiscordId": str(interaction.user.id)},
                            {"player2DiscordId": str(interaction.user.id)}
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
            except Exception as e:
                logger.error(f"Error fetching recent matches: {e}")
                # Continue without recent activity if there's an error
            
            embed.add_field(
                name="💡 Quick Actions",
                value=(
                    "• `/set-username <name>` - Update your player name\n"
                    "• `/create-match` - Start a new game\n"
                    "• `/stats` - View detailed statistics\n"
                    "• `/matchhistory` - View match history"
                ),
                inline=False
            )
            
            embed.set_footer(text="Need help? Use /help for all commands!")
            
            # Send profile via DM for privacy
            try:
                await interaction.user.send(embed=embed)
                await interaction.followup.send(
                    "✅ Your profile has been sent to your DMs! Check your private messages.",
                    ephemeral=True
                )
            except discord.Forbidden:
                # If DMs are closed, send as ephemeral
                await interaction.followup.send(
                    "❌ I couldn't send you a DM. Please enable DMs from server members and try again, or check the ephemeral message below.",
                    ephemeral=True
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
            except Exception as e:
                logger.error(f"Error sending DM: {e}")
                # Fallback to ephemeral
                await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error getting profile: {e}", exc_info=True)
            await interaction.followup.send(
                "❌ An error occurred while getting your profile. Please try again.",
                ephemeral=True
            )

    @app_commands.command(name="rate-limits")
    @app_commands.default_permissions(administrator=True)
    async def rate_limits(self, interaction: discord.Interaction):
        """View rate limiting statistics (Admin only)."""
        await get_rate_limit_stats(interaction)

    @app_commands.command(name="set-username")
    @app_commands.describe(username="Your new player name (3-20 characters)")
    async def set_username(self, interaction: discord.Interaction, username: str):
        """Set or update your player username."""
        await interaction.response.defer()
        
        try:
            # Check if command is used in the correct channel
            if interaction.channel.name != "change-username":
                embed = discord.Embed(
                    title="❌ Wrong Channel",
                    description="This command can only be used in the **#change-username** channel.",
                    color=discord.Color.red()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            # Validate username format
            if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
                embed = discord.Embed(
                    title="❌ Invalid Username",
                    description="Username must be 3-20 characters long and contain only letters, numbers, and underscores.",
                    color=discord.Color.red()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            discord_id = str(interaction.user.id)
            
            # Check if user exists
            user = safe_db_query(
                prisma.user.find_unique,
                where={"discordId": discord_id}
            )
            
            if not user:
                embed = discord.Embed(
                    title="❌ User Not Found",
                    description="You need to link your wallet first. Use `/link-wallet` to get started.",
                    color=discord.Color.red()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            # Check if username is already taken
            existing_user = safe_db_query(
                prisma.user.find_unique,
                where={"username": username}
            )
            
            if existing_user and existing_user.discordId != discord_id:
                embed = discord.Embed(
                    title="❌ Username Already Taken",
                    description=f"The username `{username}` is already taken by another player.",
                    color=discord.Color.red()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            # Check cooldown
            can_change, remaining_time = check_username_cooldown(discord_id)
            if not can_change:
                days = remaining_time.days
                hours = remaining_time.seconds // 3600
                minutes = (remaining_time.seconds % 3600) // 60
                
                time_str = ""
                if days > 0:
                    time_str += f"{days} day{'s' if days != 1 else ''} "
                if hours > 0:
                    time_str += f"{hours} hour{'s' if hours != 1 else ''} "
                if minutes > 0:
                    time_str += f"{minutes} minute{'s' if minutes != 1 else ''}"
                
                embed = discord.Embed(
                    title="❌ Username Change Cooldown",
                    description=f"You can change your username again in **{time_str.strip()}**.",
                    color=discord.Color.orange()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return

            # Update username in database
            safe_db_query(prisma.user.update, where={"discordId": str(interaction.user.id)}, data={
                "playerName": username,
                "player2DiscordId": str(interaction.user.id)
            })
            
            embed = discord.Embed(
                title="✅ Username Updated",
                description=f"Your player name has been set to **{username}**",
                color=discord.Color.green()
            )
            
            embed.add_field(
                name="👤 Current Profile",
                value=f"**Player Name:** {username}\n**Discord:** {interaction.user.display_name}\n**Wallet:** {user.address[:6]}...{user.address[-4:] if user.address else 'Not linked'}",
                inline=False
            )
            
            embed.add_field(
                name="📊 Stats",
                value=f"**Matches:** {user.totalMatches}\n**Wins:** {user.totalWins}\n**Losses:** {user.totalLosses}",
                inline=True
            )
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            update_username_cooldown(discord_id) # Update cooldown after successful change
            
        except Exception as e:
            logger.error(f"Error setting username: {e}", exc_info=True)
            await interaction.followup.send(
                "❌ An error occurred while setting your username. Please try again.",
                ephemeral=True
            )

    @app_commands.command(name="record")
    @app_commands.describe(
        opponent="Player to check record against",
        match_type="Match type to check (1v1, 2v2, 5v5, or all)"
    )
    async def player_record(self, interaction: discord.Interaction, opponent: discord.User, match_type: str = "all"):
        """Show your record against another player."""
        await interaction.response.defer()
        
        try:
            player1_id = str(interaction.user.id)
            player2_id = str(opponent.id)
            
            # Get user info
            player1 = safe_db_query(prisma.user.find_unique, where={"discordId": player1_id})
            player2 = safe_db_query(prisma.user.find_unique, where={"discordId": player2_id})
            
            if not player1:
                embed = discord.Embed(
                    title="❌ Profile Not Found",
                    description="You need to link your wallet first. Use `/link-wallet` to get started.",
                    color=discord.Color.red()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            if not player2:
                embed = discord.Embed(
                    title="❌ Opponent Not Found",
                    description=f"{opponent.display_name} hasn't linked their wallet yet.",
                    color=discord.Color.red()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            embed = discord.Embed(
                title=f"🏆 Record vs {opponent.display_name}",
                description=f"Your head-to-head record against {opponent.display_name}",
                color=discord.Color.blue()
            )
            
            if match_type == "1v1":
                # Get 1v1 rivalry record from MATCH table (since PlayerMatchup not available)
                completed_matches = safe_db_query(prisma.match.find_many, where={
                    "status": "COMPLETED",
                    "matchType": "ONE_V_ONE",
                    "OR": [
                        {"creatorDiscordId": player1_id, "player2DiscordId": player2_id},
                        {"creatorDiscordId": player2_id, "player2DiscordId": player1_id}
                    ]
                })
                
                if completed_matches:
                    your_wins = 0
                    their_wins = 0
                    
                    for match in completed_matches:
                        # Determine who won based on winnerAddress
                        if match.creatorDiscordId == player1_id:
                            # You were the creator
                            if match.winnerAddress == player1.address:
                                your_wins += 1
                            else:
                                their_wins += 1
                        else:
                            # You were the opponent
                            if match.winnerAddress == player1.address:
                                your_wins += 1
                            else:
                                their_wins += 1
                    
                    total_matches = len(completed_matches)
                    win_rate = (your_wins / total_matches * 100) if total_matches > 0 else 0
                    last_match_date = max(match.updatedAt for match in completed_matches)
                    
                    embed.add_field(
                        name="⚔️ 1v1 Head-to-Head",
                        value=(
                            f"**Record:** {your_wins}-{their_wins} ({win_rate:.1f}%)\n"
                            f"**Total Matches:** {total_matches}\n"
                            f"**Last Match:** {last_match_date.strftime('%m/%d/%Y')}"
                        ),
                        inline=False
                    )
                else:
                    embed.add_field(
                        name="⚔️ 1v1 Head-to-Head",
                        value="No 1v1 matches played yet.",
                        inline=False
                    )
            
            elif match_type in ["2v2", "5v5"]:
                # Get team rivalry record from MATCH table
                completed_matches = safe_db_query(prisma.match.find_many, where={
                    "status": "COMPLETED",
                    "matchType": "TWO_V_TWO",
                    "OR": [
                        {"creatorDiscordId": player1_id, "player2DiscordId": player2_id},
                        {"creatorDiscordId": player2_id, "player2DiscordId": player1_id}
                    ]
                })
                
                if completed_matches:
                    same_team_wins = 0
                    opposing_wins = 0
                    
                    for match in completed_matches:
                        # For team matches, we need to check if players were on same team
                        # This is simplified - in reality you'd need to check team composition
                        # For now, we'll show total matches played together
                        if match.winnerAddress == player1.address:
                            same_team_wins += 1
                        else:
                            opposing_wins += 1
                    
                    total_team_matches = len(completed_matches)
                    
                    embed.add_field(
                        name=f"🏆 {match_type} Team Matches",
                        value=(
                            f"**Total Matches Together:** {total_team_matches}\n"
                            f"**Note:** Detailed team rivalry tracking coming soon!"
                        ),
                        inline=False
                    )
                else:
                    embed.add_field(
                        name=f"🏆 {match_type} Team Matches",
                        value=f"No {match_type} matches played together yet.",
                        inline=False
                    )
            
            else:
                # Show all records
                embed.add_field(
                    name="📊 Overall Record",
                    value="Use `/record @player 1v1` for 1v1 records or `/record @player 2v2` for team records.",
                    inline=False
                )
            
            embed.set_footer(text="Use /team-stats to see your team performance breakdown")
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error getting player record: {e}", exc_info=True)
            await interaction.followup.send(
                "❌ An error occurred while getting the record. Please try again.",
                ephemeral=True
            )

    @app_commands.command(name="team-stats")
    async def team_stats(self, interaction: discord.Interaction):
        """Show your team match statistics."""
        await interaction.response.defer()
        
        try:
            player_id = str(interaction.user.id)
            
            # Get user info
            user = safe_db_query(prisma.user.find_unique, where={"discordId": player_id})
            
            if not user:
                embed = discord.Embed(
                    title="❌ Profile Not Found",
                    description="You need to link your wallet first. Use `/link-wallet` to get started.",
                    color=discord.Color.red()
                )
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            
            # Get team statistics
            team_stats = safe_db_query(
                prisma.playerTeamStats.findMany,
                where={"playerId": player_id}
            )
            
            embed = discord.Embed(
                title=f"🏆 {user.username or interaction.user.display_name}'s Team Statistics",
                description="Your performance across different match types",
                color=discord.Color.blue()
            )
            
            # Group stats by match type
            stats_by_type = {}
            for stat in team_stats:
                stats_by_type[stat.matchType] = stat
            
            # Show stats for each match type
            for match_type in ["1v1", "2v2", "5v5"]:
                stat = stats_by_type.get(match_type)
                if stat:
                    win_rate = (stat.totalWins / stat.totalMatches * 100) if stat.totalMatches > 0 else 0
                    embed.add_field(
                        name=f"📊 {match_type} Performance",
                        value=(
                            f"**Record:** {stat.totalWins}-{stat.totalLosses} ({win_rate:.1f}%)\n"
                            f"**Total Matches:** {stat.totalMatches}\n"
                            f"**Team Wins:** {stat.teamWins}\n"
                            f"**Team Losses:** {stat.teamLosses}"
                        ),
                        inline=True
                    )
                else:
                    embed.add_field(
                        name=f"📊 {match_type} Performance",
                        value="No matches played yet.",
                        inline=True
                    )
            
            embed.set_footer(text="Use /record @player to see head-to-head records")
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error getting team stats: {e}", exc_info=True)
            await interaction.followup.send(
                "❌ An error occurred while getting team stats. Please try again.",
                ephemeral=True
            )

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
        
        # Record Commands
        embed.add_field(
            name="🏆 Record Commands",
            value=(
                "`/record @player [type]` - Check record vs player\n"
                "`/team-stats` - View team performance\n"
                "`/profile` - View complete profile (DM)"
            ),
            inline=False
        )
        
        # Profile Commands
        embed.add_field(
            name="👤 Profile Commands",
            value=(
                "`/profile` - View your gaming profile\n"
                "`/set-username <name>` - Set your player name\n"
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

    @app_commands.command(name="debug-models")
    @app_commands.default_permissions(administrator=True)
    async def debug_models(self, interaction: discord.Interaction):
        """Debug command to check available Prisma models."""
        try:
            available_models = debug_prisma_models()
            
            embed = discord.Embed(
                title="🔧 Debug: Available Prisma Models",
                description=f"Found {len(available_models)} models",
                color=discord.Color.blue()
            )
            
            if available_models:
                embed.add_field(
                    name="Available Models",
                    value="\n".join([f"• `{model}`" for model in available_models]),
                    inline=False
                )
            else:
                embed.add_field(
                    name="No Models Found",
                    value="No custom models found in Prisma client",
                    inline=False
                )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except Exception as e:
            await interaction.response.send_message(f"❌ Error: {e}", ephemeral=True)

    @app_commands.command(name="test-models")
    @app_commands.default_permissions(administrator=True)
    async def test_models(self, interaction: discord.Interaction):
        """Test which Prisma models are available."""
        try:
            # Test common variations
            model_names = [
                'playermatchup', 'playerMatchup', 'player_matchup', 'PlayerMatchup',
                'playerteamstats', 'playerTeamStats', 'player_team_stats', 'PlayerTeamStats',
                'teammatchup', 'teamMatchup', 'team_matchup', 'TeamMatchup'
            ]
            
            available_models = []
            
            for model_name in model_names:
                try:
                    if hasattr(prisma, model_name):
                        available_models.append(model_name)
                except:
                    pass
            
            embed = discord.Embed(
                title="🔧 Available Prisma Models",
                description=f"Found {len(available_models)} models",
                color=discord.Color.blue()
            )
            
            if available_models:
                embed.add_field(
                    name="Available Models",
                    value="\n".join([f"• `{model}`" for model in available_models]),
                    inline=False
                )
            else:
                embed.add_field(
                    name="No Models Found",
                    value="No custom models found in Prisma client",
                    inline=False
                )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except Exception as e:
            await interaction.response.send_message(f"❌ Error: {e}", ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(UtilsCog(bot))

