import logging
import time
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional

import discord
from discord.ext import commands

from src.db.prisma import prisma
from src.utils.embeds import create_enhanced_match_embed
from .components import MatchSetupView

logger = logging.getLogger(__name__)

@dataclass
class ChannelInfo:
    """Channel information for match creation."""
    channel: discord.TextChannel
    category: discord.CategoryChannel

async def create_match_channel(interaction: discord.Interaction) -> ChannelInfo:
    """Create a dedicated channel for the match."""
    try:
        # Get the guild and category
        guild = interaction.guild
        if not guild:
            raise Exception("Guild not found")
        
        # Find or create the "OneVOne Matches" category
        category_name = "OneVOne Matches"
        category = discord.utils.get(guild.categories, name=category_name)
        
        if not category:
            category = await guild.create_category(category_name)
            logger.info(f"Created new category: {category_name}")
        
        # Create a unique channel name
        timestamp = int(time.time())
        channel_name = f"match-{timestamp}"
        
        # Create the channel
        channel = await guild.create_text_channel(
            name=channel_name,
            category=category,
            topic=f"Match channel created by {interaction.user.display_name}"
        )
        
        logger.info(f"Created match channel: {channel.name}")
        return ChannelInfo(channel=channel, category=category)
        
    except Exception as e:
        logger.error(f"Error creating match channel: {e}", exc_info=True)
        raise

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
    """Create a match in the database with retry logic."""
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Creating match in database (attempt {attempt + 1})")
            
            # Generate a unique Room ID (UUID)
            room_id = str(uuid.uuid4())
            logger.info(f"Generated Room ID: {room_id}")
            
            # Create match data with roomId instead of matchId
            match_data = {
                "roomId": room_id,
                "matchType": match_type,
                "status": "PENDING",
                "creatorDiscordId": str(interaction.user.id),
                "stake": amount or 0.0,
                "totalPrize": amount or 0.0,
                "discordChannelId": str(channel_info.channel.id),
                "game": game,
                "gameCategory": category,
                "matchAmountUsd": match_amount_usd,
                "platform": platform,
            }
            
            # Create the match
            match = prisma.match.create(data=match_data)
            logger.info(f"Successfully created match with Room ID: {room_id}")
            return match
            
        except Exception as e:
            error_msg = str(e)
            logger.warning(f"Attempt {attempt + 1} failed: {error_msg}")
            
            if "prepared statement" in error_msg and attempt < max_retries - 1:
                logger.info(f"Prepared statement error, resetting connection and retrying...")
                prisma.reset_connection()
                time.sleep(2 ** attempt)  # Exponential backoff
                continue
            elif attempt < max_retries - 1:
                logger.info(f"Database error, retrying in {2 ** attempt} seconds...")
                time.sleep(2 ** attempt)  # Exponential backoff
                continue
            else:
                logger.error(f"Failed to create match after {max_retries} attempts: {e}")
                raise

async def create_match_embeds(
    interaction: discord.Interaction,
    match: dict,
    channel_info: ChannelInfo
):
    """Create and send enhanced match embeds with setup button."""
    # Create and send enhanced match embed with button
    embed = create_enhanced_match_embed(match, interaction.user)
    view = MatchSetupView(match.roomId, match.matchAmountUsd or 0)
    
    match_message = await channel_info.channel.send(embed=embed, view=view)
    await match_message.pin()
    
    # Send welcome message with game details
    welcome_embed = discord.Embed(
        title="👋 Welcome to the Match Channel!",
        description=(
            "This channel is dedicated to your match. Here's what to do next:\n\n"
            "1️⃣ **Match Details**\n"
            f"• Platform: {match.platform}\n"
            f"• Game: {match.game} ({match.gameCategory})\n"
            f"• Match Amount: ${match.matchAmountUsd} USD\n"
            f"• Room ID: `{match.roomId}`\n\n"
            "2️⃣ **Setup Your Match**\n"
            f"• Click the '⚡ Setup Match' button above\n"
            f"• Follow the instructions in the modal\n"
            f"• Connect your wallet and set stake amount\n\n"
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

async def get_match_info(room_id: str) -> Optional[Dict]:
    """Get information about a specific match by Room ID."""
    try:
        logger.info(f"Fetching match info for Room ID: {room_id}")
        match = prisma.match.find_first(
            where={
                "roomId": room_id
            }
        )
        logger.info(f"Found match: {match}")
        return match
    except Exception as e:
        logger.error(f"Error fetching match info: {e}", exc_info=True)
        return None 