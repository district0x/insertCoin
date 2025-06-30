import discord
from typing import Optional, List, Dict
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
    
    # Use Room ID for display and URLs
    room_id_display = match.roomId[:8] + "..." if match.roomId else "N/A"
    match_id_display = f"#{match.matchId}" if match.matchId else "Pending"
    
    embed = discord.Embed(
        title=f"Room {room_id_display} ({match_id_display})",
        description=(
            f"A new {match_types.get(match.matchType, match.matchType)} match has been created!\n"
            f"Join this match to compete and win rewards!"
        ),
        color=status_colors.get(match.status, discord.Color.default())
    )
    
    # Match Details Section
    embed.add_field(
        name="Match Details",
        value=(
            f"**Type:** {match_types.get(match.matchType, match.matchType)}\n"
            f"**Status:** {match.status}\n"
            f"**Stake:** {match.stake} ETH\n"
            f"**Prize Pool:** {match.stake} ETH\n"
            f"**Created By:** {creator.mention}\n"
            f"**Room ID:** `{match.roomId}`"
        ),
        inline=False
    )
    
    # Create Match Link
    frontend_match_url = config.get_frontend_url("matches/create")
    embed.add_field(
        name="Create Match on Website",
        value=f"[Click here to create match]({frontend_match_url})",
        inline=False
    )
    
    # Instructions
    embed.add_field(
        name="How to Create Match",
        value=(
            "1. Click the link above\n"
            "2. Connect your wallet\n"
            "3. Set match parameters\n"
            "4. Create and share with opponent!"
        ),
        inline=False
    )
    
    # Add footer with Room ID and timestamp
    embed.set_footer(text=f"Room ID: {match.roomId}. Created {discord.utils.format_dt(match.createdAt, style='R')}")
    
    return embed

def create_enhanced_match_embed(match, creator: discord.User) -> discord.Embed:
    """Create an enhanced embed for match information with more details."""
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
    
    # Use Room ID for display and URLs
    room_id_display = match.roomId[:8] + "..." if match.roomId else "N/A"
    match_id_display = f"#{match.matchId}" if match.matchId else "Pending"
    
    embed = discord.Embed(
        title=f"🎮 {match_types.get(match.matchType, match.matchType)} Match Created!",
        description=(
            f"**Room {room_id_display} ({match_id_display})**\n\n"
            f"A new competitive match has been set up! Ready to challenge your opponent?"
        ),
        color=status_colors.get(match.status, discord.Color.blue())
    )
    
    # Game Details Section
    if match.game and match.platform:
        embed.add_field(
            name="🎯 Game Details",
            value=(
                f"**Game:** {match.game}\n"
                f"**Category:** {match.gameCategory}\n"
                f"**Platform:** {match.platform}\n"
                f"**Match Amount:** ${match.matchAmountUsd} USD"
            ),
            inline=True
        )
    
    # Match Details Section
    embed.add_field(
        name="💰 Match Details",
        value=(
            f"**Type:** {match_types.get(match.matchType, match.matchType)}\n"
            f"**Status:** {match.status}\n"
            f"**Stake:** {match.stake} ETH\n"
            f"**Prize Pool:** {match.totalPrize} ETH\n"
            f"**Created By:** {creator.mention}"
        ),
        inline=True
    )
    
    # Room ID Section
    embed.add_field(
        name="🔑 Room Information",
        value=(
            f"**Room ID:** `{match.roomId}`\n"
            f"**Channel:** <#{match.discordChannelId}>\n"
            f"**Created:** {discord.utils.format_dt(match.createdAt, style='R')}"
        ),
        inline=False
    )
    
    # Add footer with Room ID and timestamp
    embed.set_footer(text=f"Room ID: {match.roomId} • Created {discord.utils.format_dt(match.createdAt, style='R')}")
    
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

def create_stats_embed(stats: dict) -> discord.Embed:
    """Create an embed for user statistics."""
    embed = discord.Embed(
        title="Gaming Statistics",
        color=discord.Color.blue()
    )
    
    # Overall Stats
    embed.add_field(
        name="Overall Stats",
        value=(
            f"**Total Matches:** {stats['total_matches']}\n"
            f"**Completed Matches:** {stats['completed_matches']}\n"
            f"**Total Winnings:** {stats['total_winnings']} ETH"
        ),
        inline=False
    )
    
    # Games Played
    if stats['games_played']:
        games_list = "\n".join([f"• {game}: {count}" for game, count in stats['games_played'].items()])
        embed.add_field(
            name="Games Played",
            value=games_list,
            inline=False
        )
    
    return embed

def create_match_history_embed(history: List[Dict]) -> discord.Embed:
    """Create an embed for match history."""
    embed = discord.Embed(
        title="Recent Matches",
        color=discord.Color.blue()
    )
    
    for match in history:
        embed.add_field(
            name=f"Match #{match['id']}",
            value=(
                f"**Game:** {match['game']}\n"
                f"**Type:** {match['type']}\n"
                f"**Opponent:** {match['opponent']}\n"
                f"**Platform:** {match['platform']}\n"
                f"**Result:** {match['result']}\n"
                f"**Prize:** {match['prize']} ETH"
            ),
            inline=False
        )
    
    return embed

def create_opponent_record_embed(record: dict, opponent: discord.User) -> discord.Embed:
    """Create an embed for opponent record."""
    embed = discord.Embed(
        title=f"Record vs {opponent.name}",
        color=discord.Color.blue()
    )
    
    # Overall Record
    embed.add_field(
        name="Overall Record",
        value=(
            f"**Total Matches:** {record['total_matches']}\n"
            f"**Wins:** {record['wins']}\n"
            f"**Losses:** {record['losses']}\n"
            f"**Win Rate:** {record['win_rate']:.1f}%"
        ),
        inline=False
    )
    
    # Games Played
    if record['games_played']:
        games_list = "\n".join([f"• {game}: {count}" for game, count in record['games_played'].items()])
        embed.add_field(
            name="Games Played",
            value=games_list,
            inline=False
        )
    
    # Recent Matches
    if record['recent_matches']:
        recent_list = "\n".join([f"• {match['game']}: {match['result']}" for match in record['recent_matches']])
        embed.add_field(
            name="Recent Matches",
            value=recent_list,
            inline=False
        )
    
    return embed

def create_match_info_embed(match, creator: discord.User) -> discord.Embed:
    """Create an embed for detailed match information."""
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
    
    # Use Room ID for display and URLs
    room_id_display = match.roomId[:8] + "..." if match.roomId else "N/A"
    match_id_display = f"#{match.matchId}" if match.matchId else "Pending"
    
    embed = discord.Embed(
        title=f"Room {room_id_display} ({match_id_display})",
        description=f"{match_types.get(match.matchType, match.matchType)} Match Details",
        color=status_colors.get(match.status, discord.Color.default())
    )
    
    # Match Details Section
    embed.add_field(
        name="Match Details",
        value=(
            f"**Type:** {match_types.get(match.matchType, match.matchType)}\n"
            f"**Status:** {match.status}\n"
            f"**Stake:** {match.stake} ETH\n"
            f"**Prize Pool:** {match.totalPrize} ETH\n"
            f"**Platform:** {match.platform}\n"
            f"**Game:** {match.game} ({match.gameCategory})\n"
            f"**Match Amount:** ${match.matchAmountUsd} USD\n"
            f"**Room ID:** `{match.roomId}`"
        ),
        inline=False
    )
    
    # Players Section
    players_info = f"**Creator:** {creator.mention}\n"
    if match.opponentDiscordId:
        players_info += f"**Opponent:** <@{match.opponentDiscordId}>"
    else:
        players_info += "**Opponent:** Not joined yet"
    
    if match.status == "COMPLETED" and match.winnerAddress:
        players_info += f"\n**Winner:** <@{match.winnerId}>"
    
    embed.add_field(
        name="Players",
        value=players_info,
        inline=False
    )
    
    # Match Link - use matchId if available, otherwise show pending message
    if match.matchId:
        frontend_match_url = config.get_frontend_url(f"matches/{match.matchId}")
        embed.add_field(
            name="Match Link",
            value=f"[View Match on Website]({frontend_match_url})",
            inline=False
        )
    else:
        embed.add_field(
            name="Match Status",
            value="⏳ Match is pending creation on the blockchain. Use the setup button to create it.",
            inline=False
        )
    
    # Add footer with Room ID and timestamp
    embed.set_footer(text=f"Room ID: {match.roomId}. Created {discord.utils.format_dt(match.createdAt, style='R')}")
    
    return embed
