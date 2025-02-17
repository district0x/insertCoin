import logging
from typing import Optional, Literal

import discord
from discord import app_commands
from discord.ext import commands

from src.db.prisma import prisma
from src.utils.embeds import create_match_embed
from src.web3.contract import contract

logger = logging.getLogger(__name__)

class MatchCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        
    @app_commands.command(name="create-match")
    @app_commands.describe(
        match_type="Type of match",
        amount="Stake amount in ETH (optional)"
    )
    @app_commands.choices(match_type=[
        app_commands.Choice(name="1v1", value="ONE_V_ONE"),
        app_commands.Choice(name="2v2", value="TWO_V_TWO"),
        app_commands.Choice(name="5v5", value="FIVE_V_FIVE"),
    ])
    async def create_match(
        self,
        interaction: discord.Interaction,
        match_type: str,
        amount: Optional[float] = None
    ):
        """Create a new match."""
        await interaction.response.defer()
        
        try:
            logger.info(f"Creating match with type: {match_type}, amount: {amount}")
            
            # Get next match ID from contract
            logger.info("Getting next match ID from contract...")
            try:
                next_match_id = contract.contract.functions.nextMatchId().call()
                logger.info(f"Next match ID from contract: {next_match_id}")
            except Exception as e:
                logger.error(f"Error getting next match ID: {e}", exc_info=True)
                raise
            
            # Create match channel
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
            
            # Create match in database
            logger.info(f"Creating match in database with ID: {next_match_id}")
            match_data = {
                "matchId": next_match_id,
                "matchType": match_type,
                "status": "PENDING",
                "stake": amount or 0.0,
                "creatorDiscordId": str(interaction.user.id),
                "totalPrize": amount or 0.0,
                "discordChannelId": str(channel.id)  # Save the channel ID
            }
            logger.info(f"Match data to be created: {match_data}")
            
            match = prisma.match.create(data=match_data)
            logger.info(f"Match created in database: {match}")
            
            # Update channel name with match ID
            await channel.edit(name=f"match-{match.id[:8]}")
            
            # Create and send match embed
            embed = create_match_embed(match, interaction.user)
            match_message = await channel.send(embed=embed)
            await match_message.pin()  # Pin the match details
            
            # Send welcome message
            welcome_embed = discord.Embed(
                title="👋 Welcome to the Match Channel!",
                description=(
                    "This channel is dedicated to your match. Here's what to do next:\n\n"
                    "1️⃣ **Create the Match on Website**\n"
                    f"• Use the link in the pinned message above to create your match\n"
                    "• Set your match parameters and stake amount\n\n"
                    "2️⃣ **Share with Opponent**\n"
                    "• Once created, share the match link with your opponent\n"
                    "• Use this channel to coordinate game details\n\n"
                    "3️⃣ **Need Help?**\n"
                    "• Use `/match-info` to see match details\n"
                    "• Ask questions in this channel"
                ),
                color=discord.Color.blue()
            )
            await channel.send(embed=welcome_embed)
            
            # Send success message to user
            await interaction.followup.send(
                f"✅ Match created successfully! Head over to {channel.mention} to get started.",
                ephemeral=True
            )
            logger.info("Match creation completed successfully")
            
        except Exception as e:
            logger.error(f"Error creating match: {e}", exc_info=True)
            await interaction.followup.send(
                "An error occurred while creating the match. Please try again.",
                ephemeral=True
            )
            
    @app_commands.command(name="match-info")
    @app_commands.describe(match_id="ID of the match to get info about")
    async def match_info(
        self,
        interaction: discord.Interaction,
        match_id: str
    ):
        """Get information about a specific match."""
        await interaction.response.defer()
        
        try:
            match = prisma.match.find_first(
                where={
                    "id": match_id
                }
            )
            
            if not match:
                await interaction.followup.send(
                    "Match not found.",
                    ephemeral=True
                )
                return
                
            creator = await self.bot.fetch_user(int(match.creatorDiscordId))
            embed = create_match_embed(match, creator)
            
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error(f"Error getting match info: {e}", exc_info=True)
            await interaction.followup.send(
                "An error occurred while getting match info. Please try again.",
                ephemeral=True
            )
            
    @app_commands.command(name="my-matches")
    async def my_matches(self, interaction: discord.Interaction):
        """List all your matches."""
        await interaction.response.defer()
        
        try:
            matches = prisma.match.find_many(
                where={
                    "creatorDiscordId": str(interaction.user.id)
                },
                order={
                    "createdAt": "desc"
                }
            )
            
            if not matches:
                await interaction.followup.send(
                    "You haven't created any matches yet.",
                    ephemeral=True
                )
                return
                
            embed = discord.Embed(
                title="Your Matches",
                color=discord.Color.blue()
            )
            
            for match in matches:
                channel = discord.utils.get(
                    interaction.guild.channels,
                    name=f"match-{match.id[:8]}"
                )
                channel_mention = channel.mention if channel else "Channel not found"
                
                embed.add_field(
                    name=f"Match {match.id[:8]}",
                    value=f"""
                    Type: {match.matchType}
                    Status: {match.status}
                    Stake: {match.stake} ETH
                    Channel: {channel_mention}
                    """,
                    inline=False
                )
                
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error(f"Error listing matches: {e}", exc_info=True)
            await interaction.followup.send(
                "An error occurred while listing your matches. Please try again.",
                ephemeral=True
            )

async def setup(bot: commands.Bot):
    await bot.add_cog(MatchCog(bot))
