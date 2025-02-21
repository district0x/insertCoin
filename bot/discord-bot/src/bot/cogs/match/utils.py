"""Utility functions for match-related functionality."""

import logging
from dataclasses import dataclass
from typing import Optional, List, Dict

import discord
from src.db.prisma import prisma
from src.web3.contract import contract
from .embeds import create_match_embed

logger = logging.getLogger(__name__)

@dataclass
class ChannelInfo:
    """Channel information for match creation."""
    channel: discord.TextChannel
    category: discord.CategoryChannel

async def create_match_channel(interaction: discord.Interaction) -> ChannelInfo:
    """Create a match channel and return channel info."""
    logger.info("Creating match channel...")
    category = discord.utils.get(interaction.guild.categories, name="Matches")
    if not category:
        logger.info("Matches category not found, creating new one...")
        category = await interaction.guild.create_category("Matches")
        
    channel = await interaction.guild.create_text_channel(
        name=f"match-pending",
        category=category
    )
    logger.info(f"Created channel: {channel.name}")
    
    return ChannelInfo(channel=channel, category=category)

async def create_match_in_db(
    interaction: discord.Interaction,
    match_type: str,
    platform: str,
    category: str,
    game: str,
    match_amount_usd: int,
    amount: Optional[float],
    channel_info: ChannelInfo
) -> dict:
    """Create a match in the database."""
    logger.info("Getting next match ID from contract...")
    try:
        next_match_id = contract.contract.functions.nextMatchId().call()
        logger.info(f"Next match ID from contract: {next_match_id}")
    except Exception as e:
        logger.error(f"Error getting next match ID: {e}", exc_info=True)
        raise
    
    match_data = {
        "matchId": next_match_id,
        "matchType": match_type,
        "status": "PENDING",
        "stake": amount or 0.0,
        "creatorDiscordId": str(interaction.user.id),
        "totalPrize": amount or 0.0,
        "discordChannelId": str(channel_info.channel.id),
        "platform": platform,
        "gameCategory": category,
        "game": game,
        "matchAmountUsd": match_amount_usd
    }
    logger.info(f"Match data to be created: {match_data}")
    
    match = prisma.match.create(data=match_data)
    logger.info(f"Match created in database: {match}")
    
    # Update channel name with match ID
    await channel_info.channel.edit(name=f"match-{match.id[:8]}")
    
    return match

async def create_match_embeds(
    interaction: discord.Interaction,
    match: dict,
    channel_info: ChannelInfo
):
    """Create and send match embeds."""
    # Create and send match embed
    embed = create_match_embed(match, interaction.user)
    match_message = await channel_info.channel.send(embed=embed)
    await match_message.pin()
    
    # Send welcome message with game details
    welcome_embed = discord.Embed(
        title="👋 Welcome to the Match Channel!",
        description=(
            "This channel is dedicated to your match. Here's what to do next:\n\n"
            "1️⃣ **Match Details**\n"
            f"• Platform: {match.platform}\n"
            f"• Game: {match.game} ({match.gameCategory})\n"
            f"• Match Amount: ${match.matchAmountUsd} USD\n\n"
            "2️⃣ **Create the Match on Website**\n"
            f"• Use the link in the pinned message above to create your match\n"
            "• Set your match parameters and stake amount\n\n"
            "3️⃣ **Share with Opponent**\n"
            "• Once created, share the match link with your opponent\n"
            "• Use this channel to coordinate game details\n\n"
            "4️⃣ **Need Help?**\n"
            "• Use `/match-info` to see match details\n"
            "• Ask questions in this channel"
        ),
        color=discord.Color.blue()
    )
    await channel_info.channel.send(embed=welcome_embed)

async def get_user_stats(user_id: str) -> Optional[Dict]:
    """Get user's match statistics."""
    matches = prisma.match.find_many(
        where={
            "OR": [
                {"creatorDiscordId": str(user_id)},
                {"opponentDiscordId": str(user_id)}
            ]
        }
    )
    
    if not matches:
        return None
        
    total_matches = len(matches)
    completed_matches = len([m for m in matches if m.status == "COMPLETED"])
    total_winnings = sum(m.totalPrize for m in matches if m.winnerId == str(user_id))
    
    games_played = {}
    for match in matches:
        if match.game:
            games_played[match.game] = games_played.get(match.game, 0) + 1
            
    return {
        "total_matches": total_matches,
        "completed_matches": completed_matches,
        "total_winnings": total_winnings,
        "games_played": games_played
    }

async def get_match_history(user_id: str, bot) -> Optional[List[Dict]]:
    """Get user's match history."""
    matches = prisma.match.find_many(
        where={
            "OR": [
                {"creatorDiscordId": str(user_id)},
                {"opponentDiscordId": str(user_id)}
            ]
        },
        order={
            "createdAt": "desc"
        },
        take=10
    )
    
    if not matches:
        return None
        
    history = []
    for match in matches:
        opponent_id = match.opponentDiscordId or "No opponent yet"
        try:
            opponent = await bot.fetch_user(int(opponent_id)) if opponent_id != "No opponent yet" else None
            opponent_name = opponent.name if opponent else "No opponent yet"
        except:
            opponent_name = "Unknown opponent"
            
        result = "In Progress"
        if match.status == "COMPLETED":
            if match.winnerId == str(user_id):
                result = "Won 🏆"
            else:
                result = "Lost 💔"
                
        history.append({
            "id": match.id,
            "game": match.game,
            "type": match.matchType,
            "opponent": opponent_name,
            "platform": match.platform,
            "result": result,
            "prize": match.totalPrize
        })
        
    return history

async def get_opponent_record(user_id: str, opponent_id: str) -> Optional[Dict]:
    """Get record against specific opponent."""
    matches = prisma.match.find_many(
        where={
            "OR": [
                {
                    "AND": [
                        {"creatorDiscordId": str(user_id)},
                        {"opponentDiscordId": str(opponent_id)}
                    ]
                },
                {
                    "AND": [
                        {"creatorDiscordId": str(opponent_id)},
                        {"opponentDiscordId": str(user_id)}
                    ]
                }
            ]
        },
        order={
            "createdAt": "desc"
        }
    )
    
    if not matches:
        return None
        
    total_matches = len(matches)
    completed_matches = [m for m in matches if m.status == "COMPLETED"]
    wins = len([m for m in completed_matches if m.winnerId == str(user_id)])
    losses = len([m for m in completed_matches if m.winnerId == str(opponent_id)])
    
    games_played = {}
    for match in matches:
        if match.game:
            games_played[match.game] = games_played.get(match.game, 0) + 1
            
    recent_matches = []
    for match in matches[:5]:
        result = "In Progress"
        if match.status == "COMPLETED":
            result = "Won 🏆" if match.winnerId == str(user_id) else "Lost 💔"
        recent_matches.append({
            "game": match.game or "Unknown Game",
            "result": result
        })
            
    return {
        "total_matches": total_matches,
        "wins": wins,
        "losses": losses,
        "win_rate": (wins/len(completed_matches)*100 if completed_matches else 0),
        "games_played": games_played,
        "recent_matches": recent_matches
    }

async def get_match_info(match_id: str) -> Optional[Dict]:
    """Get information about a specific match."""
    match = prisma.match.find_first(
        where={
            "id": match_id
        }
    )
    return match 