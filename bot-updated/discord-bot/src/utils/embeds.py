import discord
from typing import Optional
from datetime import datetime
from src.utils.config import config

def create_match_embed(match, creator: discord.User) -> discord.Embed:
    """Create an embed for match information."""
    status_colors = {
        "PENDING": discord.Color.yellow(),
        "OPEN": discord.Color.green(),
        "FILLED": discord.Color.blue(),
        "COMPLETED": discord.Color.purple(),
        "CANCELLED": discord.Color.red()
    }
    
    match_types = {
        "ONE_V_ONE": "1v1",
        "TWO_V_TWO": "2v2",
        "FIVE_V_FIVE": "5v5"
    }
    
    embed = discord.Embed(
        title=f"🎮 Match #{match.matchId}",
        description=(
            f"A new {match_types.get(match.matchType, match.matchType)} match has been created!\n"
            f"Join this match to compete and win rewards! 🏆"
        ),
        color=status_colors.get(match.status, discord.Color.default()),
        timestamp=datetime.now()
    )
    
    # Match Details Section
    embed.add_field(
        name="💫 Match Details",
        value=(
            f"**Type:** {match_types.get(match.matchType, match.matchType)}\n"
            f"**Status:** {match.status}\n"
            f"**Stake:** {match.stake} ETH\n"
            f"**Prize Pool:** {match.totalPrize} ETH"
        ),
        inline=False
    )
    
    # Creator Info
    embed.add_field(
        name="👑 Created By",
        value=creator.mention,
        inline=True
    )
    
    # Join Link
    frontend_match_url = config.get_frontend_url("matches/create")
    embed.add_field(
        name="🔗 Create Match on Website",
        value=f"[Click here to create match]({frontend_match_url})",
        inline=True
    )
    
    # Instructions
    embed.add_field(
        name="📝 How to Create Match",
        value=(
            "1. Click the link above\n"
            "2. Connect your wallet\n"
            "3. Set match parameters\n"
            "4. Create and share with opponent!"
        ),
        inline=False
    )
    
    # Footer
    embed.set_footer(text=f"Match ID: {match.matchId} • Created")
    
    return embed

def create_team_embed(team, match_type: str) -> discord.Embed:
    """Create an embed for team information."""
    embed = discord.Embed(
        title=f"Team {'A' if team.isTeamA else 'B'}",
        color=discord.Color.blue()
    )
    
    # Calculate required players based on match type
    required_players = {
        "ONE_V_ONE": 1,
        "TWO_V_TWO": 2,
        "FIVE_V_FIVE": 5
    }.get(match_type, 1)
    
    current_players = len(team.members)
    
    # Add team details
    embed.add_field(
        name="Players",
        value="\n".join([f"• {member.username}" for member in team.members]) or "No players yet",
        inline=False
    )
    
    embed.add_field(
        name="Status",
        value=f"{current_players}/{required_players} players",
        inline=True
    )
    
    return embed

def create_error_embed(title: str, description: str) -> discord.Embed:
    """Create an embed for error messages."""
    return discord.Embed(
        title=f"❌ {title}",
        description=description,
        color=discord.Color.red()
    )

def create_success_embed(title: str, description: str) -> discord.Embed:
    """Create an embed for success messages."""
    return discord.Embed(
        title=f"✅ {title}",
        description=description,
        color=discord.Color.green()
    )
