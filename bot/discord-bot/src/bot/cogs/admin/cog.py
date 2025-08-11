"""Admin cog implementation for player moderation."""

import logging
from typing import Optional
import discord
from discord import app_commands
from discord.ext import commands

from src.services.ban_service import BanService
from src.db.prisma import prisma

logger = logging.getLogger(__name__)

class AdminCog(commands.Cog, name="Admin"):
    """Cog for handling administrative commands."""
    
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.ban_service = BanService(prisma)
        super().__init__()

    @app_commands.command(name="ban")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        user="User to ban",
        reason="Reason for the ban",
        duration="Ban duration (24h, 7d, 30d, or permanent)"
    )
    @app_commands.choices(duration=[
        app_commands.Choice(name="24 hours", value="24h"),
        app_commands.Choice(name="7 days", value="7d"),
        app_commands.Choice(name="30 days", value="30d"),
        app_commands.Choice(name="Permanent", value="permanent")
    ])
    async def ban_player(
        self,
        interaction: discord.Interaction,
        user: discord.User,
        reason: str,
        duration: str
    ):
        """Ban a player from the platform (Admin only)."""
        await interaction.response.defer(ephemeral=True)
        
        try:
            # Check if user exists in database
            if not await self._user_exists(user.id):
                await interaction.followup.send(
                    f"❌ User {user.mention} is not registered in the system.",
                    ephemeral=True
                )
                return
            
            # Check if user is already banned
            is_banned, _, _ = await self.ban_service.is_player_banned(str(user.id))
            if is_banned:
                await interaction.followup.send(
                    f"❌ User {user.mention} is already banned.",
                    ephemeral=True
                )
                return
            
            # Execute ban
            success, message = await self.ban_service.ban_player(
                str(user.id),
                reason,
                duration,
                str(interaction.user.id)
            )
            
            if success:
                # Apply Discord role restrictions
                role_applied = False
                if interaction.guild:
                    role_applied = await self._apply_banned_role(interaction.guild, user)
                
                embed = discord.Embed(
                    title="🔨 Player Banned",
                    description=f"**{user.display_name}** has been banned from the platform.",
                    color=discord.Color.red()
                )
                embed.add_field(name="Reason", value=reason, inline=False)
                embed.add_field(name="Duration", value=duration, inline=False)
                embed.add_field(name="Banned By", value=interaction.user.display_name, inline=False)
                embed.add_field(name="Discord Role", value="✅ Applied" if role_applied else "❌ Failed", inline=False)
                embed.set_footer(text=f"User ID: {user.id}")
                
                await interaction.followup.send(embed=embed, ephemeral=True)
                
                # Log to audit channel if available
                await self._log_admin_action(interaction.guild, f"🔨 **{interaction.user.display_name}** banned **{user.display_name}** for: {reason} | Role: {'Applied' if role_applied else 'Failed'}")
                
            else:
                await interaction.followup.send(f"❌ {message}", ephemeral=True)
                
        except Exception as e:
            logger.error(f"Error in ban command: {e}")
            await interaction.followup.send(
                "❌ An error occurred while processing the ban command.",
                ephemeral=True
            )

    @app_commands.command(name="unban")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(user="User to unban")
    async def unban_player(
        self,
        interaction: discord.Interaction,
        user: discord.User
    ):
        """Unban a player from the platform (Admin only)."""
        await interaction.response.defer(ephemeral=True)
        
        try:
            # Check if user is banned
            is_banned, _, _ = await self.ban_service.is_player_banned(str(user.id))
            if not is_banned:
                await interaction.followup.send(
                    f"❌ User {user.mention} is not currently banned.",
                    ephemeral=True
                )
                return
            
            # Execute unban
            success, message = await self.ban_service.unban_player(str(user.id))
            
            if success:
                # Remove Discord role restrictions
                role_removed = False
                if interaction.guild:
                    role_removed = await self._remove_banned_role(interaction.guild, user)
                
                embed = discord.Embed(
                    title="✅ Player Unbanned",
                    description=f"**{user.display_name}** has been unbanned from the platform.",
                    color=discord.Color.green()
                )
                embed.add_field(name="Unbanned By", value=interaction.user.display_name, inline=False)
                embed.add_field(name="Discord Role", value="✅ Removed" if role_removed else "❌ Failed", inline=False)
                embed.set_footer(text=f"User ID: {user.id}")
                
                await interaction.followup.send(embed=embed, ephemeral=True)
                
                # Log to audit channel
                await self._log_admin_action(interaction.guild, f"✅ **{interaction.user.display_name}** unbanned **{user.display_name}** | Role: {'Removed' if role_removed else 'Failed'}")
                
            else:
                await interaction.followup.send(f"❌ {message}", ephemeral=True)
                
        except Exception as e:
            logger.error(f"Error in unban command: {e}")
            await interaction.followup.send(
                "❌ An error occurred while processing the unban command.",
                ephemeral=True
            )

    @app_commands.command(name="player-info")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(user="User to get information about")
    async def player_info(
        self,
        interaction: discord.Interaction,
        user: discord.User
    ):
        """Get detailed player information including ban status (Admin only)."""
        await interaction.response.defer(ephemeral=True)
        
        try:
            player_data = await self.ban_service.get_player_info(str(user.id))
            
            if not player_data:
                await interaction.followup.send(
                    f"❌ User {user.mention} is not registered in the system.",
                    ephemeral=True
                )
                return
            
            embed = discord.Embed(
                title=f"📊 Player Information: {player_data.get('username', 'Unknown')}",
                color=discord.Color.blue()
            )
            
            # Basic info
            embed.add_field(name="Discord ID", value=user.id, inline=True)
            embed.add_field(name="Wallet", value=player_data.get('address', 'Not linked')[:10] + "...", inline=True)
            embed.add_field(name="Member Since", value=player_data.get('createdAt', 'Unknown').strftime('%Y-%m-%d'), inline=True)
            
            # Stats
            embed.add_field(name="Total Matches", value=player_data.get('totalMatches', 0), inline=True)
            embed.add_field(name="Wins", value=player_data.get('totalWins', 0), inline=True)
            embed.add_field(name="Losses", value=player_data.get('totalLosses', 0), inline=True)
            
            # Ban status
            if player_data.get('isBanned'):
                embed.add_field(
                    name="🚫 Ban Status", 
                    value=f"BANNED\nReason: {player_data.get('banReason', 'Unknown')}\nExpires: {player_data.get('banExpiry', 'Permanent')}", 
                    inline=False
                )
                embed.color = discord.Color.red()
            else:
                embed.add_field(name="✅ Ban Status", value="Not banned", inline=False)
            
            # Ban history
            ban_history = player_data.get('banHistory', [])
            if ban_history:
                history_text = "\n".join([
                    f"• {record['reason']} (by {record['bannedBy']}) - {record['bannedAt'].strftime('%Y-%m-%d')}"
                    for record in ban_history[:3]  # Show last 3 bans
                ])
                embed.add_field(name="📜 Recent Ban History", value=history_text, inline=False)
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error in player-info command: {e}")
            await interaction.followup.send(
                "❌ An error occurred while getting player information.",
                ephemeral=True
            )

    @app_commands.command(name="banned-players")
    @app_commands.default_permissions(administrator=True)
    async def list_banned_players(self, interaction: discord.Interaction):
        """List all currently banned players (Admin only)."""
        await interaction.response.defer(ephemeral=True)
        
        try:
            banned_players = await self.ban_service.get_banned_players()
            
            if not banned_players:
                await interaction.followup.send("✅ No players are currently banned.", ephemeral=True)
                return
            
            embed = discord.Embed(
                title="🚫 Currently Banned Players",
                color=discord.Color.red()
            )
            
            for player in banned_players:
                username = player.get('username', 'Unknown')
                reason = player.get('banReason', 'No reason given')
                expiry = player.get('banExpiry', 'Permanent')
                
                if expiry and expiry != 'Permanent':
                    expiry_str = expiry.strftime('%Y-%m-%d %H:%M UTC')
                else:
                    expiry_str = "Permanent"
                
                embed.add_field(
                    name=username,
                    value=f"**Reason:** {reason}\n**Expires:** {expiry_str}",
                    inline=False
                )
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error in banned-players command: {e}")
            await interaction.followup.send(
                "❌ An error occurred while getting banned players list.",
                ephemeral=True
            )

    @app_commands.command(name="setup-banned-role")
    @app_commands.default_permissions(administrator=True)
    async def setup_banned_role(self, interaction: discord.Interaction):
        """Set up the Banned role with proper permissions on all channels (Admin only)."""
        await interaction.response.defer(ephemeral=True)
        
        try:
            if not interaction.guild:
                await interaction.followup.send("❌ This command can only be used in a server.", ephemeral=True)
                return
            
            # Check bot permissions
            if not interaction.guild.me.guild_permissions.manage_roles:
                await interaction.followup.send("❌ Bot needs 'Manage Roles' permission to set up the Banned role.", ephemeral=True)
                return
            
            # Get or create the Banned role
            banned_role = await self._get_or_create_banned_role(interaction.guild)
            if not banned_role:
                await interaction.followup.send("❌ Failed to create Banned role.", ephemeral=True)
                return
            
            # Apply permissions to all channels
            channels_updated = 0
            for channel in interaction.guild.channels:
                if isinstance(channel, (discord.TextChannel, discord.VoiceChannel)):
                    try:
                        await channel.set_permissions(banned_role, 
                            read_messages=False,  # Can't see channels
                            send_messages=False,  # Can't send messages
                            connect=False,        # Can't join voice
                            speak=False          # Can't speak in voice
                        )
                        channels_updated += 1
                    except Exception as e:
                        logger.warning(f"Could not update permissions for {channel.name}: {e}")
            
            embed = discord.Embed(
                title="✅ Banned Role Setup Complete",
                description=f"Successfully configured the **{banned_role.name}** role.",
                color=discord.Color.green()
            )
            embed.add_field(name="Role Created", value=banned_role.mention, inline=True)
            embed.add_field(name="Channels Updated", value=channels_updated, inline=True)
            embed.add_field(name="Permissions", value="No access to channels", inline=False)
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
            # Log to audit channel
            await self._log_admin_action(interaction.guild, f"🔧 **{interaction.user.display_name}** set up Banned role permissions on {channels_updated} channels")
            
        except Exception as e:
            logger.error(f"Error in setup-banned-role command: {e}")
            await interaction.followup.send(
                "❌ An error occurred while setting up the Banned role.",
                ephemeral=True
            )

    async def _user_exists(self, discord_id: int) -> bool:
        """Check if a user exists in the database."""
        try:
            user = await prisma.user.find_unique(where={"discordId": str(discord_id)})
            return user is not None
        except Exception:
            return False

    async def _log_admin_action(self, guild: Optional[discord.Guild], message: str):
        """Log admin actions to audit channel if available."""
        if not guild:
            return
        
        try:
            # Look for audit-log channel
            audit_channel = discord.utils.get(guild.channels, name="audit-log")
            if not audit_channel:
                # Create audit-log channel if it doesn't exist
                audit_channel = await self._create_audit_channel(guild)
            
            if audit_channel and isinstance(audit_channel, discord.TextChannel):
                await audit_channel.send(message)
        except Exception as e:
            logger.warning(f"Could not log to audit channel: {e}")

    async def _create_audit_channel(self, guild: discord.Guild) -> Optional[discord.TextChannel]:
        """Create audit-log channel with proper permissions."""
        try:
            # Check if bot has permission to create channels
            if not guild.me.guild_permissions.manage_channels:
                logger.warning("Bot lacks permission to create audit-log channel")
                return None
            
            # Create audit-log channel
            audit_channel = await guild.create_text_channel(
                name="audit-log",
                topic="Admin action audit log - Only administrators can see this channel",
                overwrites={
                    guild.default_role: discord.PermissionOverwrite(read_messages=False),  # Hidden from everyone
                    guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True),  # Bot can see and send
                    # Only users with Administrator permission can see this channel
                }
            )
            
            # Set permissions for users with Administrator permission
            for role in guild.roles:
                if role.permissions.administrator:
                    await audit_channel.set_permissions(role, read_messages=True, send_messages=False)
            
            logger.info(f"Created audit-log channel: {audit_channel.name}")
            return audit_channel
            
        except Exception as e:
            logger.error(f"Error creating audit-log channel: {e}")
            return None

    async def _get_or_create_banned_role(self, guild: discord.Guild) -> Optional[discord.Role]:
        """Get or create the 'Banned' role for restricted users."""
        try:
            # Look for existing Banned role
            banned_role = discord.utils.get(guild.roles, name="Banned")
            
            if not banned_role:
                # Check if bot has permission to create roles
                if not guild.me.guild_permissions.manage_roles:
                    logger.warning("Bot lacks permission to create Banned role")
                    return None
                
                # Create Banned role with restrictive permissions
                banned_role = await guild.create_role(
                    name="Banned",
                    color=discord.Color.dark_red(),
                    reason="Role for banned users - restricts chat access",
                    permissions=discord.Permissions.none()  # No permissions
                )
                
                # Set role permissions on all channels
                for channel in guild.channels:
                    if isinstance(channel, (discord.TextChannel, discord.VoiceChannel)):
                        await channel.set_permissions(banned_role, 
                            read_messages=False,  # Can't see channels
                            send_messages=False,  # Can't send messages
                            connect=False,        # Can't join voice
                            speak=False          # Can't speak in voice
                        )
                
                logger.info(f"Created Banned role: {banned_role.name}")
            
            return banned_role
            
        except Exception as e:
            logger.error(f"Error getting/creating Banned role: {e}")
            return None

    async def _apply_banned_role(self, guild: discord.Guild, user: discord.Member):
        """Apply the Banned role to a user."""
        try:
            banned_role = await self._get_or_create_banned_role(guild)
            if not banned_role:
                return False
            
            # Add the Banned role to the user
            if banned_role not in user.roles:
                await user.add_roles(banned_role, reason="User banned from platform")
                logger.info(f"Applied Banned role to {user.display_name}")
                return True
            
            return True
            
        except Exception as e:
            logger.error(f"Error applying Banned role to {user.display_name}: {e}")
            return False

    async def _remove_banned_role(self, guild: discord.Guild, user: discord.Member):
        """Remove the Banned role from a user."""
        try:
            banned_role = discord.utils.get(guild.roles, name="Banned")
            if not banned_role:
                return False
            
            # Remove the Banned role from the user
            if banned_role in user.roles:
                await user.remove_roles(banned_role, reason="User unbanned from platform")
                logger.info(f"Removed Banned role from {user.display_name}")
                return True
            
            return True
            
        except Exception as e:
            logger.error(f"Error removing Banned role from {user.display_name}: {e}")
            return False 