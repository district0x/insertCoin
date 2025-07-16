"""Discord UI components for match creation."""

import discord
import logging
from discord import ui
from typing import Optional
from src.utils.config import config
from src.utils.price_converter import PriceConverter

logger = logging.getLogger(__name__)

class JoinMatchRoomButton(ui.Button):
    """Button to join the private match room."""
    
    def __init__(self, room_id: str, channel_id: str, match_amount_usd: int):
        super().__init__(
            label="🎮 Join Match Room",
            style=discord.ButtonStyle.success,
            emoji="🚪",
            custom_id=f"join_room_{room_id}"
        )
        self.room_id = room_id
        self.channel_id = channel_id
        self.match_amount_usd = match_amount_usd
        
    async def callback(self, interaction: discord.Interaction):
        """Handle button click - give user access to match room."""
        try:
            # Get the match room channel
            channel = interaction.guild.get_channel(int(self.channel_id))
            if not channel:
                await interaction.response.send_message(
                    "❌ Match room not found. It may have been deleted.",
                    ephemeral=True
                )
                return
            
            # Give the user access to the match room
            await channel.set_permissions(
                interaction.user,
                read_messages=True,
                send_messages=True
            )
            
            # Create success embed
            embed = discord.Embed(
                title="🎮 Access Granted!",
                description=(
                    f"✅ You now have access to the match room!\n\n"
                    f"💰 **Match Amount:** ${self.match_amount_usd} USD\n"
                    f"🔗 **Room:** {channel.mention}\n\n"
                    f"🎯 **Next Steps:**\n"
                    f"• Head to {channel.mention} to coordinate with other players\n"
                    f"• Use the room to discuss match details\n"
                    f"• Share the blockchain match link once created"
                ),
                color=discord.Color.green()
            )
            
            embed.set_footer(text=f"Room ID: {self.room_id[:8]}... • Access granted")
            
            await interaction.response.send_message(
                embed=embed,
                ephemeral=True
            )
            
            # Send welcome message to the match room
            welcome_embed = discord.Embed(
                title="👋 New Player Joined!",
                description=(
                    f"**{interaction.user.mention}** has joined the match room!\n\n"
                    f"🎮 **Welcome to the match coordination space.**\n"
                    f"💰 **Match Amount:** ${self.match_amount_usd} USD\n\n"
                    f"💬 **Use this room to:**\n"
                    f"• Coordinate match details\n"
                    f"• Share blockchain match links\n"
                    f"• Discuss game strategies\n"
                    f"• Find additional players\n\n"
                    f"⚡ **Setup Match button is now available below!**"
                ),
                color=discord.Color.blue()
            )
            
            # Add Setup Match button when player joins
            from .components import MatchRoomView
            setup_view = MatchRoomView(self.room_id, self.match_amount_usd)
            
            await channel.send(embed=welcome_embed, view=setup_view)
            
        except Exception as e:
            logger.error(f"Error giving user access to match room: {e}")
            await interaction.response.send_message(
                f"❌ Error accessing match room: {str(e)}",
                ephemeral=True
            )

class SetupMatchButton(ui.Button):
    """Button to open match setup modal."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__(
            label="⚡ Setup Match",
            style=discord.ButtonStyle.primary,
            emoji="🎮",
            custom_id=f"setup_match_{room_id}"
        )
        self.room_id = room_id
        self.match_amount_usd = match_amount_usd
        
    async def callback(self, interaction: discord.Interaction):
        """Handle button click - open setup modal."""
        modal = MatchSetupModal(self.room_id, self.match_amount_usd)
        await interaction.response.send_modal(modal)

class CreateMatchButton(ui.Button):
    """Button to create the match on blockchain."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__(
            label="🚀 Create Match",
            style=discord.ButtonStyle.danger,
            emoji="⚡",
            custom_id=f"create_match_{room_id}"
        )
        self.room_id = room_id
        self.match_amount_usd = match_amount_usd
        
    async def callback(self, interaction: discord.Interaction):
        """Handle button click - redirect to create match page."""
        try:
            from src.db.prisma import prisma
            
            # Verify this is the creator
            match = prisma.match.find_unique(
                where={"roomId": self.room_id}
            )
            
            if not match:
                await interaction.response.send_message(
                    "❌ Match not found.",
                    ephemeral=True
                )
                return
                
            if match.creatorDiscordId != str(interaction.user.id):
                await interaction.response.send_message(
                    "❌ Only the match creator can create the match on blockchain.",
                    ephemeral=True
                )
                return
            
            # Get current ETH price and convert USD to ETH
            eth_price_usd = PriceConverter.get_eth_price_usd()
            eth_amount = PriceConverter.usd_to_eth(self.match_amount_usd, eth_price_usd)
            
            # Create the frontend URL
            frontend_url = config.get_frontend_url(f"matches/create?roomId={self.room_id}&discord=true&amount={self.match_amount_usd}&ethAmount={eth_amount:.6f}")
            
            # Create success embed with link
            embed = discord.Embed(
                title="🚀 Ready to Create Match!",
                description=(
                    f"**Room {self.room_id[:8]}...** is ready for blockchain creation!\n\n"
                    f"💰 **Match Amount:** ${self.match_amount_usd} USD\n"
                    f"⚡ **ETH Equivalent:** {PriceConverter.format_eth_amount(eth_amount)} (Rate: ${eth_price_usd:.2f}/ETH)\n\n"
                    f"🎮 **Next Steps:**\n"
                    f"1. Click the link below\n"
                    f"2. Connect your wallet\n"
                    f"3. Set stake amount (pre-filled with {PriceConverter.format_eth_amount(eth_amount)})\n"
                    f"4. Create the match on blockchain\n"
                    f"5. Share the match link with your opponent!\n\n"
                    f"🔗 **[Click Here to Create Match]({frontend_url})**"
                ),
                color=discord.Color.green()
            )
            
            embed.set_footer(text=f"Room ID: {self.room_id[:8]}... • Ready for blockchain creation")
            
            await interaction.response.send_message(
                embed=embed,
                ephemeral=True
            )
            
        except Exception as e:
            await interaction.response.send_message(
                f"❌ Error preparing match creation: {str(e)}",
                ephemeral=True
            )

class MatchSetupModal(ui.Modal, title="🎮 Match Setup"):
    """Modal for match setup instructions."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__()
        self.room_id = room_id
        self.match_amount_usd = match_amount_usd
        
        # Get current ETH price and convert USD to ETH
        eth_price_usd = PriceConverter.get_eth_price_usd()
        eth_amount = PriceConverter.usd_to_eth(match_amount_usd, eth_price_usd)
        
        # Create the frontend URL with room ID and ETH amount
        frontend_url = config.get_frontend_url(f"matches/create?roomId={room_id}&discord=true&amount={match_amount_usd}&ethAmount={eth_amount:.6f}")
        
        # Instructions text
        self.instructions = ui.TextInput(
            label="📋 Setup Instructions",
            placeholder="Follow these steps to complete your match setup...",
            default=(
                f"🎯 **Room {room_id[:8]}... Setup Instructions**\n\n"
                f"💰 **Match Amount:** ${match_amount_usd} USD\n"
                f"⚡ **ETH Equivalent:** {PriceConverter.format_eth_amount(eth_amount)} (Rate: ${eth_price_usd:.2f}/ETH)\n\n"
                f"⚡ **Quick Setup Steps:**\n\n"
                f"1️⃣ **Click the link below** to open the match creation page\n"
                f"2️⃣ **Connect your wallet** (MetaMask, WalletConnect, etc.)\n"
                f"3️⃣ **Set your stake amount** (pre-filled with {PriceConverter.format_eth_amount(eth_amount)})\n"
                f"4️⃣ **Review and create** the match on the blockchain\n"
                f"5️⃣ **Share the match link** with your opponent\n\n"
                f"🔗 **Direct Link:** {frontend_url}\n\n"
                f"💡 **Pro Tips:**\n"
                f"• Make sure you have enough ETH for gas fees\n"
                f"• The stake amount is pre-converted from USD to ETH\n"
                f"• Your opponent will need to join with the same stake amount\n"
                f"• Use this Discord channel to coordinate with your opponent\n"
                f"• ETH price may fluctuate - check current rates before confirming"
            ),
            style=discord.TextStyle.paragraph,
            required=False,
            max_length=4000
        )
        
        self.add_item(self.instructions)
        
    async def on_submit(self, interaction: discord.Interaction):
        """Handle modal submission."""
        # Get current ETH price and convert USD to ETH
        eth_price_usd = PriceConverter.get_eth_price_usd()
        eth_amount = PriceConverter.usd_to_eth(self.match_amount_usd, eth_price_usd)
        
        # Create a follow-up message with the direct link
        embed = discord.Embed(
            title="🎮 Ready to Setup Match!",
            description=(
                f"**Room {self.room_id[:8]}...** is ready for setup!\n\n"
                f"💰 **Match Amount:** ${self.match_amount_usd} USD\n"
                f"⚡ **ETH Equivalent:** {PriceConverter.format_eth_amount(eth_amount)} (Rate: ${eth_price_usd:.2f}/ETH)\n\n"
                f"⚡ **Next Steps:**\n"
                f"1. Click the link below\n"
                f"2. Connect your wallet\n"
                f"3. Set stake amount (pre-filled with {PriceConverter.format_eth_amount(eth_amount)})\n"
                f"4. Create and share with opponent!\n\n"
                f"🔗 **[Click Here to Setup Match]({config.get_frontend_url(f'matches/create?roomId={self.room_id}&discord=true&amount={self.match_amount_usd}&ethAmount={eth_amount:.6f}')})**"
            ),
            color=discord.Color.green()
        )
        
        embed.set_footer(text=f"Room ID: {self.room_id[:8]}... • Amount: ${self.match_amount_usd} USD • ETH: {PriceConverter.format_eth_amount(eth_amount)}")
        
        await interaction.response.send_message(
            embed=embed,
            ephemeral=True
        )

class MatchPostView(ui.View):
    """View containing only the join match room button for the original post."""
    
    def __init__(self, room_id: str, channel_id: str, match_amount_usd: int):
        super().__init__(timeout=None)  # No timeout
        self.add_item(JoinMatchRoomButton(room_id, channel_id, match_amount_usd))

class MatchRoomView(ui.View):
    """View containing only the setup match button for the private match room."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__(timeout=None)  # No timeout
        self.add_item(SetupMatchButton(room_id, match_amount_usd))

class MatchCreateView(ui.View):
    """View containing the create match button."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__(timeout=None)  # No timeout
        self.add_item(CreateMatchButton(room_id, match_amount_usd)) 