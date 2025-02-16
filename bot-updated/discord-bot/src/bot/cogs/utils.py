import logging
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from src.db.prisma import prisma
from src.web3.contract import contract

logger = logging.getLogger(__name__)

class UtilsCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        
    @app_commands.command(name="link-wallet")
    @app_commands.describe(
        wallet_address="Your Ethereum wallet address",
        signature="Signature to verify wallet ownership"
    )
    async def link_wallet(
        self,
        interaction: discord.Interaction,
        wallet_address: str,
        signature: str
    ):
        """Link your Discord account with your Ethereum wallet."""
        await interaction.response.defer()
        
        try:
            # Verify wallet ownership
            if not contract.verify_wallet(wallet_address, signature):
                await interaction.followup.send(
                    "Invalid signature. Please try again.",
                    ephemeral=True
                )
                return
                
            # Check if wallet is already linked
            existing_user = await prisma.user.find_first(
                where={
                    "OR": [
                        {"address": wallet_address},
                        {"discordId": str(interaction.user.id)}
                    ]
                }
            )
            
            if existing_user:
                await interaction.followup.send(
                    "This wallet or Discord account is already linked.",
                    ephemeral=True
                )
                return
                
            # Create or update user
            user = await prisma.user.create({
                "data": {
                    "address": wallet_address,
                    "discordId": str(interaction.user.id),
                    "username": str(interaction.user)
                }
            })
            
            await interaction.followup.send(
                f"Successfully linked wallet {wallet_address[:6]}...{wallet_address[-4:]} to your Discord account!",
                ephemeral=True
            )
            
        except Exception as e:
            logger.error(f"Error linking wallet: {e}", exc_info=True)
            await interaction.followup.send(
                "An error occurred while linking your wallet. Please try again.",
                ephemeral=True
            )
            
    @app_commands.command(name="help")
    async def help_command(self, interaction: discord.Interaction):
        """Show help information about the bot."""
        embed = discord.Embed(
            title="OneVOne Bot Help",
            description="Here are the available commands:",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="Match Commands",
            value="""
            `/create-match` - Create a new match
            `/match-info` - Get information about a match
            `/my-matches` - List all your matches
            """,
            inline=False
        )
        
        embed.add_field(
            name="Utility Commands",
            value="""
            `/link-wallet` - Link your Ethereum wallet
            `/help` - Show this help message
            """,
            inline=False
        )
        
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(UtilsCog(bot))
