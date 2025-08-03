import logging
import time
import uuid
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

import discord
from discord.ext import commands

from src.db.prisma import prisma
from src.utils.embeds import create_enhanced_match_embed
from .components import MatchPostView, MatchRoomView

logger = logging.getLogger(__name__)

@dataclass
class ChannelInfo:
    """Channel information for match creation."""
    channel: discord.TextChannel
    category: discord.CategoryChannel

def clean_channel_name(name: str) -> str:
    """Clean and format channel name for Discord."""
    # Remove special characters that Discord doesn't allow in channel names
    cleaned = re.sub(r'[^\w\s-]', '', name)
    # Replace spaces with hyphens
    cleaned = re.sub(r'\s+', '-', cleaned)
    # Convert to lowercase
    cleaned = cleaned.lower()
    # Limit to 100 characters (Discord limit)
    if len(cleaned) > 100:
        cleaned = cleaned[:97] + "..."
    return cleaned

def generate_match_channel_name(match_type: str, platform: str, game: str, amount: int) -> str:
    """Generate a descriptive channel name from match details."""
    # Format: {Type}-{Platform}-{Game}-${Amount}
    channel_name = f"{match_type}-{platform}-{game}-${amount}"
    return clean_channel_name(channel_name)

async def get_user_by_discord_id(discord_id: str) -> Optional[discord.User]:
    """Get Discord user by Discord ID."""
    try:
        # This would need to be called from a context where we have access to the bot
        # For now, we'll return a mock user or handle this differently
        # In a real implementation, you'd need to pass the bot instance
        return None
    except Exception as e:
        logger.error(f"Error getting user by Discord ID {discord_id}: {e}")
        return None

async def create_match_channel(interaction: discord.Interaction, match_data: dict) -> ChannelInfo:
    """Create a dedicated channel for the match with hybrid approach."""
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
        
        # Generate descriptive channel name
        channel_name = generate_match_channel_name(
            match_data["matchType"],
            match_data["platform"],
            match_data["game"],
            match_data["matchAmountUsd"]
        )
        
        # Set up permissions - hidden from everyone by default
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),  # Hidden from everyone
            guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_messages=True),  # Bot can see and manage
            interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),  # Creator can see and send
        }
        
        # Create the channel with restricted permissions
        channel = await guild.create_text_channel(
            name=channel_name,
            category=category,
            topic=f"Match channel created by {interaction.user.display_name} - Join via match post to access!",
            overwrites=overwrites
        )
        
        logger.info(f"Created restricted match channel: {channel.name}")
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
    token_type: str,
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
                "stake": match_amount_usd if token_type == "MATCH" else (amount or match_amount_usd),
                "totalPrize": match_amount_usd if token_type == "MATCH" else (amount or match_amount_usd),
                "discordChannelId": str(channel_info.channel.id),
                "game": game,
                "gameCategory": category,
                "matchAmountUsd": match_amount_usd,
                "platform": platform,
                "tokenName": token_type,
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
    """Create and send match embeds with hybrid approach."""
    # Create match post for the original room (where command was used)
    from src.utils.embeds import create_enhanced_match_embed
    from .components import MatchPostView
    
    # Create the match post embed
    embed = create_enhanced_match_embed(match, interaction.user)
    
    # Add information about the private match room
    embed.add_field(
        name="🎮 Private Match Room",
        value=(
            f"**A private coordination room has been created:** {channel_info.channel.mention}\n\n"
            f"🔒 **Access:** Click 'Join Match Room' to get access\n"
            f"💬 **Purpose:** Coordinate with other players\n"
            f"🎯 **Features:** Share match links, discuss strategies\n\n"
            f"*The match room is hidden from the server by default and only visible to participants.*"
        ),
        inline=False
    )
    
    # Create view with join room and setup buttons
    view = MatchPostView(match.roomId, str(channel_info.channel.id), match.matchAmountUsd or 0)
    
    # Send the match post in the original room
    match_message = await interaction.channel.send(embed=embed, view=view)
    await match_message.pin()
    
    # Send welcome message to the private match room
    token_type = match.tokenName or "ETH"
    token_display = f"${match.matchAmountUsd} USD" if token_type == "ETH" else f"{match.matchAmountUsd} MATCH Tokens"
    
    welcome_embed = discord.Embed(
        title="🎮 Welcome to the Match Room!",
        description=(
            "This is your private match coordination space.\n\n"
            "1️⃣ **Match Details**\n"
            f"• Platform: {match.platform}\n"
            f"• Game: {match.game} ({match.gameCategory})\n"
            f"• Match Amount: {token_display}\n"
            f"• Token Type: {token_type}\n"
            f"• Room ID: `{match.roomId}`\n\n"
            "2️⃣ **Waiting for Players**\n"
            f"• Share the original post with potential opponents\n"
            f"• They need to click 'Join Match Room' to access this room\n"
            f"• Once another player joins, the '⚡ Setup Match' button will appear\n\n"
            "3️⃣ **Coordinate with Players**\n"
            f"• Use this room to discuss match details\n"
            f"• Share blockchain match links\n"
            f"• Coordinate game strategies\n"
            f"• Find additional players if needed\n\n"
            "4️⃣ **Privacy**\n"
            f"• This room is only visible to participants\n"
            f"• Others can join by clicking 'Join Match Room' in the original post\n\n"
            "🔒 **Private Room:** Only participants can see this channel."
        ),
        color=discord.Color.blue()
    )
    
    # Don't add Setup Match button initially - it will appear when players join
    await channel_info.channel.send(embed=welcome_embed)

async def get_user_stats(user_id: str) -> Optional[Dict]:
    """Get user's match statistics."""
    matches = prisma.match.find_many(
        where={
            "OR": [
                {"creatorDiscordId": str(user_id)},
                {"player2DiscordId": str(user_id)}
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
                {"player2DiscordId": str(user_id)}
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
        opponent_id = match.player2DiscordId or "No opponent yet"
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
                        {"player2DiscordId": str(opponent_id)}
                    ]
                },
                {
                    "AND": [
                        {"creatorDiscordId": str(opponent_id)},
                        {"player2DiscordId": str(user_id)}
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