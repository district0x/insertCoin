"""Discord UI components for match creation."""

import discord
from discord import ui
from typing import Optional
from src.utils.config import config
from src.utils.price_converter import PriceConverter

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

class MatchSetupView(ui.View):
    """View containing the setup match button."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__(timeout=None)  # No timeout
        self.add_item(SetupMatchButton(room_id, match_amount_usd)) 