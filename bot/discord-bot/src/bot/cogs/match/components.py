"""Discord UI components for match creation."""

import discord
import logging
from discord import ui
from typing import Optional
from src.utils.config import config
from src.utils.price_converter import PriceConverter

logger = logging.getLogger(__name__)

# Minimal in-memory room locks to prevent double creation
_creation_locks: dict[str, tuple[str, float]] = {}
_LOCK_TTL_SECONDS = 600.0  # 10 minutes

def _cleanup_locks(now: float) -> None:
    expired = [k for k, (_, exp) in _creation_locks.items() if exp <= now]
    for k in expired:
        _creation_locks.pop(k, None)

def _acquire_lock(room_id: str, user_id: str) -> bool:
    import time
    now = time.time()
    _cleanup_locks(now)
    owner_exp = _creation_locks.get(room_id)
    if not owner_exp:
        _creation_locks[room_id] = (user_id, now + _LOCK_TTL_SECONDS)
        return True
    owner, exp = owner_exp
    if exp <= now:
        _creation_locks[room_id] = (user_id, now + _LOCK_TTL_SECONDS)
        return True
    return owner == user_id

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
                    f"🚀 **Create Match button is now available below!**\n"
                    f"*Any player in this room can commit to creating the match.*"
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
        """Handle button click - show confirmation modal."""
        try:
            from src.db.prisma import prisma
            
            # Verify match exists
            match = prisma.match.find_unique(
                where={"roomId": self.room_id}
            )
            
            if not match:
                await interaction.response.send_message(
                    "❌ Match not found.",
                    ephemeral=True
                )
                return
            
            # Block only if already on-chain (status no longer PENDING)
            try:
                if getattr(match, "status", "PENDING") != "PENDING":
                    await interaction.response.send_message(
                        "⚠️ This match has already been created on-chain.",
                        ephemeral=True
                    )
                    return
            except Exception:
                pass
            
            # Soft-lock to reduce races (not final, rechecked on submit)
            user_id = str(interaction.user.id)
            if not _acquire_lock(self.room_id, user_id):
                await interaction.response.send_message(
                    "⚠️ Another player is already starting this match. Please wait.",
                    ephemeral=True
                )
                return
            
            # Check if user has access to the match room
            if not await self._user_has_room_access(interaction.user, match.discordChannelId):
                await interaction.response.send_message(
                    "❌ You need to join the match room first to create a match.",
                    ephemeral=True
                )
                return
            
            # Show confirmation modal
            modal = MatchCommitmentModal(self.room_id, self.match_amount_usd, str(interaction.user.id))
            await interaction.response.send_modal(modal)
            
        except Exception as e:
            logger.error(f"Error in create match button: {e}")
            await interaction.response.send_message(
                f"❌ Error preparing match creation: {str(e)}",
                ephemeral=True
            )

    async def _user_has_room_access(self, user: discord.User, channel_id: str) -> bool:
        """Check if a user has access to the match room."""
        try:
            channel = user.guild.get_channel(int(channel_id))
            if not channel:
                return False
            
            # Check if user can see the channel (has permissions)
            permissions = channel.permissions_for(user)
            return permissions.read_messages
            
        except Exception as e:
            logger.error(f"Error checking user room access: {e}")
            return False

class MatchCommitmentModal(ui.Modal, title="🎮 Match Commitment"):
    """Modal for confirming match commitment."""
    
    def __init__(self, room_id: str, match_amount_usd: int, player_discord_id: str):
        super().__init__()
        self.room_id = room_id
        self.match_amount_usd = match_amount_usd
        self.player_discord_id = player_discord_id
        
        # Commitment confirmation
        self.commitment = ui.TextInput(
            label="✅ Confirm to start this match",
            placeholder="Type 'Start' to confirm...",
            style=discord.TextStyle.short,
            required=True,
            max_length=20
        )
        
        self.add_item(self.commitment)
        
    async def on_submit(self, interaction: discord.Interaction):
        """Handle modal submission."""
        try:
            # Double-check: block if already on-chain
            from src.db.prisma import prisma
            current = prisma.match.find_unique(where={"roomId": self.room_id})
            try:
                if current and getattr(current, "status", "PENDING") != "PENDING":
                    await interaction.response.send_message(
                        "⚠️ This match has already been created on-chain.",
                        ephemeral=True
                    )
                    return
            except Exception:
                pass
            
            # Acquire hard lock for submit
            user_id = str(interaction.user.id)
            if not _acquire_lock(self.room_id, user_id):
                await interaction.response.send_message(
                    "⚠️ Another player is already starting this match.",
                    ephemeral=True
                )
                return
            
            if self.commitment.value.strip().lower() != "start":
                await interaction.response.send_message(
                    "❌ Please type 'Start' to confirm.",
                    ephemeral=True
                )
                return
            
            # Get user's wallet address if they have one linked
            user = prisma.user.find_unique(
                where={"discordId": self.player_discord_id}
            )
            
            if not user or not user.address:
                await interaction.response.send_message(
                    "❌ You need to link your wallet first before creating a match.\n\n"
                    "Use `/link-wallet` to connect your wallet.",
                    ephemeral=True
                )
                return
            
            # Update the match with the committing player's information (overwrite allowed while PENDING)
            prisma.match.update(
                where={"roomId": self.room_id},
                data={
                    "creatorDiscordId": self.player_discord_id,
                    "creatorAddress": user.address
                }
            )
            
            # Now proceed with the match creation
            await self._proceed_to_match_creation(interaction, user.address)
            
        except Exception as e:
            logger.error(f"Error in commitment modal: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while processing your commitment. Please try again.",
                ephemeral=True
            )
    
    async def _proceed_to_match_creation(self, interaction: discord.Interaction, wallet_address: str):
        """Proceed to match creation after commitment."""
        try:
            from src.db.prisma import prisma
            from src.utils.price_converter import PriceConverter
            from src.utils.config import config
            
            # Get updated match data
            match = prisma.match.find_unique(
                where={"roomId": self.room_id}
            )
            
            if not match:
                await interaction.response.send_message(
                    "❌ Match not found.",
                    ephemeral=True
                )
                return
            
            # Get token type from database
            token_type = match.tokenName or "ETH"  # Default to ETH if not set
            
            # Create frontend URL based on token type
            if token_type == "ETH":
                # Get current ETH price and convert USD to ETH
                eth_price_usd = PriceConverter.get_eth_price_usd()
                eth_amount = PriceConverter.usd_to_eth(self.match_amount_usd, eth_price_usd)
                
                # Create the frontend URL with ETH parameters
                frontend_url = config.get_frontend_url(f"matches/create?roomId={self.room_id}&discord=true&amount={self.match_amount_usd}&ethAmount={eth_amount:.6f}&tokenType=ETH")
                
                # Create success embed with ETH info
                embed = discord.Embed(
                    title="🚀 Ready to Create Match!",
                    description=(
                        f"**Room {self.room_id[:8]}...** is ready for blockchain creation!\n\n"
                        f"💰 **Match Amount:** ${self.match_amount_usd} USD\n"
                        f"⚡ **Token Type:** ETH\n"
                        f"⚡ **ETH Equivalent:** {PriceConverter.format_eth_amount(eth_amount)} (Rate: ${eth_price_usd:.2f}/ETH)\n"
                        f"👤 **Your Wallet:** {wallet_address[:10]}...\n\n"
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
            else:
                # MATCH tokens - no conversion needed
                frontend_url = config.get_frontend_url(f"matches/create?roomId={self.room_id}&discord=true&amount={self.match_amount_usd}&tokenType=MATCH")
                
                # Create success embed with MATCH token info
                embed = discord.Embed(
                    title="🚀 Ready to Create Match!",
                    description=(
                        f"**Room {self.room_id[:8]}...** is ready for blockchain creation!\n\n"
                        f"💰 **Match Amount:** {self.match_amount_usd} MATCH Tokens\n"
                        f"⚡ **Token Type:** MATCH Tokens\n"
                        f"👤 **Your Wallet:** {wallet_address[:10]}...\n\n"
                        f"🎮 **Next Steps:**\n"
                        f"1. Click the link below\n"
                        f"2. Connect your wallet\n"
                        f"3. Set stake amount (pre-filled with {self.match_amount_usd} MATCH tokens)\n"
                        f"4. Create the match on blockchain\n"
                        f"5. Share the match link with your opponent!\n\n"
                        f"🔗 **[Click Here to Create Match]({frontend_url})**"
                    ),
                    color=discord.Color.green()
                )
            
            embed.set_footer(text=f"Room ID: {self.room_id[:8]}... • Committed by {interaction.user.display_name}")
            
            await interaction.response.send_message(
                embed=embed,
                ephemeral=True
            )
            
            # Log the commitment to the match room
            await self._log_commitment_to_room(interaction, match, wallet_address)
            
            # Append InviteOpponentView to the ephemeral response to creator
            view = InviteOpponentView(self.room_id)
            await interaction.followup.send(view=view, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error proceeding to match creation: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while preparing match creation. Please try again.",
                ephemeral=True
            )
    
    async def _log_commitment_to_room(self, interaction: discord.Interaction, match: dict, wallet_address: str):
        """Log the commitment to the match room."""
        try:
            channel = interaction.guild.get_channel(int(match.discordChannelId))
            if channel:
                commitment_embed = discord.Embed(
                    title="✅ Match Commitment Confirmed!",
                    description=(
                        f"**{interaction.user.mention}** has committed to completing this match!\n\n"
                        f"👤 **Player:** {interaction.user.display_name}\n"
                        f"💰 **Wallet:** {wallet_address[:10]}...\n"
                        f"🎮 **Status:** Ready for blockchain creation\n\n"
                        f"🚀 **Next:** Player will create the match on blockchain and share the link here."
                    ),
                    color=discord.Color.green()
                )
                
                await channel.send(embed=commitment_embed)
                
        except Exception as e:
            logger.warning(f"Could not log commitment to room: {e}")

class MatchSetupModal(ui.Modal, title="🎮 Match Setup"):
    """Modal for match setup instructions."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__()
        self.room_id = room_id
        self.match_amount_usd = match_amount_usd
        
        # Get token type from database
        from src.db.prisma import prisma
        match = prisma.match.find_unique(where={"roomId": room_id})
        token_type = match.tokenName if match else "ETH"
        
        if token_type == "ETH":
            # Get current ETH price and convert USD to ETH
            eth_price_usd = PriceConverter.get_eth_price_usd()
            eth_amount = PriceConverter.usd_to_eth(match_amount_usd, eth_price_usd)
            
            # Create the frontend URL with room ID and ETH amount
            frontend_url = config.get_frontend_url(f"matches/create?roomId={room_id}&discord=true&amount={match_amount_usd}&ethAmount={eth_amount:.6f}&tokenType=ETH")
            
            # Instructions text for ETH
            instructions_text = (
                f"🎯 **Room {room_id[:8]}... Setup Instructions**\n\n"
                f"💰 **Match Amount:** ${match_amount_usd} USD\n"
                f"⚡ **Token Type:** ETH\n"
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
            )
        else:
            # MATCH tokens - no conversion needed
            frontend_url = config.get_frontend_url(f"matches/create?roomId={room_id}&discord=true&amount={match_amount_usd}&tokenType=MATCH")
            
            # Instructions text for MATCH tokens
            instructions_text = (
                f"🎯 **Room {room_id[:8]}... Setup Instructions**\n\n"
                f"💰 **Match Amount:** {match_amount_usd} MATCH Tokens\n"
                f"⚡ **Token Type:** MATCH Tokens\n\n"
                f"⚡ **Quick Setup Steps:**\n\n"
                f"1️⃣ **Click the link below** to open the match creation page\n"
                f"2️⃣ **Connect your wallet** (MetaMask, WalletConnect, etc.)\n"
                f"3️⃣ **Set your stake amount** (pre-filled with {match_amount_usd} MATCH tokens)\n"
                f"4️⃣ **Review and create** the match on the blockchain\n"
                f"5️⃣ **Share the match link** with your opponent\n\n"
                f"🔗 **Direct Link:** {frontend_url}\n\n"
                f"💡 **Pro Tips:**\n"
                f"• Make sure you have enough MATCH tokens in your wallet\n"
                f"• The stake amount is in whole MATCH tokens (no decimals)\n"
                f"• Your opponent will need to join with the same stake amount\n"
                f"• Use this Discord channel to coordinate with your opponent\n"
                f"• MATCH tokens are platform-specific tokens for OneVOne matches"
            )
        
        # Instructions text
        self.instructions = ui.TextInput(
            label="📋 Setup Instructions",
            placeholder="Follow these steps to complete your match setup...",
            default=instructions_text,
            style=discord.TextStyle.paragraph,
            required=False,
            max_length=4000
        )
        
        self.add_item(self.instructions)
        
    async def on_submit(self, interaction: discord.Interaction):
        """Handle modal submission."""
        # Get token type from database
        from src.db.prisma import prisma
        match = prisma.match.find_unique(where={"roomId": self.room_id})
        token_type = match.tokenName if match else "ETH"
        
        if token_type == "ETH":
            # Get current ETH price and convert USD to ETH
            eth_price_usd = PriceConverter.get_eth_price_usd()
            eth_amount = PriceConverter.usd_to_eth(self.match_amount_usd, eth_price_usd)
            
            # Create a follow-up message with the direct link for ETH
            embed = discord.Embed(
                title="🎮 Ready to Setup Match!",
                description=(
                    f"**Room {self.room_id[:8]}...** is ready for setup!\n\n"
                    f"💰 **Match Amount:** ${self.match_amount_usd} USD\n"
                    f"⚡ **Token Type:** ETH\n"
                    f"⚡ **ETH Equivalent:** {PriceConverter.format_eth_amount(eth_amount)} (Rate: ${eth_price_usd:.2f}/ETH)\n\n"
                    f"⚡ **Next Steps:**\n"
                    f"1. Click the link below\n"
                    f"2. Connect your wallet\n"
                    f"3. Set stake amount (pre-filled with {PriceConverter.format_eth_amount(eth_amount)})\n"
                    f"4. Create and share with opponent!\n\n"
                    f"🔗 **[Click Here to Setup Match]({config.get_frontend_url(f'matches/create?roomId={self.room_id}&discord=true&amount={self.match_amount_usd}&ethAmount={eth_amount:.6f}&tokenType=ETH')})**"
                ),
                color=discord.Color.green()
            )
        else:
            # Create a follow-up message with the direct link for MATCH tokens
            embed = discord.Embed(
                title="🎮 Ready to Setup Match!",
                description=(
                    f"**Room {self.room_id[:8]}...** is ready for setup!\n\n"
                    f"💰 **Match Amount:** {self.match_amount_usd} MATCH Tokens\n"
                    f"⚡ **Token Type:** MATCH Tokens\n\n"
                    f"⚡ **Next Steps:**\n"
                    f"1. Click the link below\n"
                    f"2. Connect your wallet\n"
                    f"3. Set stake amount (pre-filled with {self.match_amount_usd} MATCH tokens)\n"
                    f"4. Create and share with opponent!\n\n"
                    f"🔗 **[Click Here to Setup Match]({config.get_frontend_url(f'matches/create?roomId={self.room_id}&discord=true&amount={self.match_amount_usd}&tokenType=MATCH')})**"
                ),
                color=discord.Color.green()
            )
        
        embed.set_footer(text=f"Room ID: {self.room_id[:8]}... • Amount: {self.match_amount_usd} {'USD' if token_type == 'ETH' else 'MATCH Tokens'}")
        
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
    """View containing the create match button for the private match room."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__(timeout=None)  # No timeout
        self.add_item(CreateMatchButton(room_id, match_amount_usd))

class JoinStartButton(ui.Button):
    """Button for opponents to open the Start modal and confirm participation."""
    
    def __init__(self, room_id: str):
        super().__init__(
            label="✅ Join / Start",
            style=discord.ButtonStyle.primary,
            emoji="✅",
            custom_id=f"join_start_{room_id}"
        )
        self.room_id = room_id
    
    async def callback(self, interaction: discord.Interaction):
        try:
            modal = PlayerStartModal(self.room_id, str(interaction.user.id))
            await interaction.response.send_modal(modal)
        except Exception as e:
            logger.error(f"Error opening PlayerStartModal: {e}")
            await interaction.response.send_message("❌ Error opening start modal.", ephemeral=True)

class PlayerStartModal(ui.Modal, title="✅ Confirm Participation"):
    def __init__(self, room_id: str, player_discord_id: str):
        super().__init__()
        self.room_id = room_id
        self.player_discord_id = player_discord_id
        self.confirm = ui.TextInput(
            label="Type 'Start' to confirm",
            placeholder="Start",
            style=discord.TextStyle.short,
            required=True,
            max_length=20
        )
        self.add_item(self.confirm)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            if self.confirm.value.strip().lower() != "start":
                await interaction.response.send_message("❌ Please type 'Start' to confirm.", ephemeral=True)
                return
            from src.db.prisma import prisma
            # Check match status
            match = prisma.match.find_unique(where={"roomId": self.room_id})
            if not match:
                await interaction.response.send_message("❌ Match not found.", ephemeral=True)
                return
            if getattr(match, "status", "PENDING") != "PENDING":
                await interaction.response.send_message("⚠️ Match already created on-chain.", ephemeral=True)
                return
            # Do not allow the creator to claim player2 slot
            if getattr(match, "creatorDiscordId", None) == self.player_discord_id:
                await interaction.response.send_message("⚠️ You already committed as creator.", ephemeral=True)
                return
            # Link wallet if exists
            user = prisma.user.find_unique(where={"discordId": self.player_discord_id})
            # Update player2 info (address optional)
            prisma.match.update(
                where={"roomId": self.room_id},
                data={
                    "player2DiscordId": self.player_discord_id,
                    "player2Address": getattr(user, "address", None)
                }
            )
            await interaction.response.send_message("✅ You have confirmed. Waiting for on-chain creation.", ephemeral=True)
        except Exception as e:
            logger.error(f"Error in PlayerStartModal: {e}")
            await interaction.response.send_message("❌ Error confirming participation.", ephemeral=True)

class GetLinkButton(ui.Button):
    def __init__(self, room_id: str):
        super().__init__(
            label="🔗 Get Link",
            style=discord.ButtonStyle.secondary,
            custom_id=f"get_link_{room_id}"
        )
        self.room_id = room_id
    
    async def callback(self, interaction: discord.Interaction):
        try:
            from src.db.prisma import prisma
            from src.utils.price_converter import PriceConverter
            from src.utils.config import config
            match = prisma.match.find_unique(where={"roomId": self.room_id})
            if not match:
                await interaction.response.send_message("❌ Match not found.", ephemeral=True)
                return
            token_type = getattr(match, "tokenName", "ETH") or "ETH"
            amount_usd = getattr(match, "matchAmountUsd", 0) or 0
            if token_type == "ETH":
                eth_price = PriceConverter.get_eth_price_usd()
                eth_amount = PriceConverter.usd_to_eth(amount_usd, eth_price)
                url = config.get_frontend_url(
                    f"matches/create?roomId={self.room_id}&discord=true&amount={amount_usd}&ethAmount={eth_amount:.6f}&tokenType=ETH"
                )
            else:
                url = config.get_frontend_url(
                    f"matches/create?roomId={self.room_id}&discord=true&amount={amount_usd}&tokenType=MATCH"
                )
            await interaction.response.send_message(
                f"🔗 Copy this link and paste it in the match lobby:\n{url}",
                ephemeral=True
            )
        except Exception as e:
            logger.error(f"Error building link: {e}")
            await interaction.response.send_message("❌ Error getting link.", ephemeral=True)

class PostInviteButton(ui.Button):
    def __init__(self, room_id: str):
        super().__init__(
            label="📣 Post to Lobby",
            style=discord.ButtonStyle.primary,
            custom_id=f"post_invite_{room_id}"
        )
        self.room_id = room_id
    
    async def callback(self, interaction: discord.Interaction):
        try:
            from src.db.prisma import prisma
            from src.utils.price_converter import PriceConverter
            from src.utils.config import config
            match = prisma.match.find_unique(where={"roomId": self.room_id})
            if not match:
                await interaction.response.send_message("❌ Match not found.", ephemeral=True)
                return
            channel_id = getattr(match, "discordChannelId", None)
            if not channel_id:
                await interaction.response.send_message("❌ Lobby channel missing.", ephemeral=True)
                return
            channel = interaction.guild.get_channel(int(channel_id))
            if not channel:
                await interaction.response.send_message("❌ Lobby channel not found.", ephemeral=True)
                return
            token_type = getattr(match, "tokenName", "ETH") or "ETH"
            amount_usd = getattr(match, "matchAmountUsd", 0) or 0
            if token_type == "ETH":
                eth_price = PriceConverter.get_eth_price_usd()
                eth_amount = PriceConverter.usd_to_eth(amount_usd, eth_price)
                url = config.get_frontend_url(
                    f"matches/create?roomId={self.room_id}&discord=true&amount={amount_usd}&ethAmount={eth_amount:.6f}&tokenType=ETH"
                )
                amount_text = f"${amount_usd} USD (~{eth_amount:.6f} ETH)"
            else:
                url = config.get_frontend_url(
                    f"matches/create?roomId={self.room_id}&discord=true&amount={amount_usd}&tokenType=MATCH"
                )
                amount_text = f"{amount_usd} MATCH"
            invite_embed = discord.Embed(
                title="🎯 Opponent Needed",
                description=(
                    f"A new match is forming!\n\n"
                    f"💰 Amount: {amount_text}\n"
                    f"🔗 Link: {url}\n\n"
                    f"Press the button below and type 'Start' to confirm your participation."
                ),
                color=discord.Color.orange()
            )
            view = ui.View(timeout=None)
            view.add_item(JoinStartButton(self.room_id))
            await channel.send(embed=invite_embed, view=view)
            await interaction.response.send_message("✅ Posted invite to the lobby.", ephemeral=True)
        except Exception as e:
            logger.error(f"Error posting invite: {e}")
            await interaction.response.send_message("❌ Error posting to lobby.", ephemeral=True)

class InviteOpponentView(ui.View):
    def __init__(self, room_id: str):
        super().__init__(timeout=None)
        self.add_item(PostInviteButton(room_id))
        self.add_item(GetLinkButton(room_id))

class MatchCreateView(ui.View):
    """View containing the create match button."""
    
    def __init__(self, room_id: str, match_amount_usd: int):
        super().__init__(timeout=None)  # No timeout
        self.add_item(CreateMatchButton(room_id, match_amount_usd)) 