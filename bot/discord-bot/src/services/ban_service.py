"""Ban management service for player moderation."""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from prisma import Prisma

logger = logging.getLogger(__name__)

class BanService:
    """Service for managing player bans and reputation."""
    
    def __init__(self, prisma: Prisma):
        self.prisma = prisma
    
    async def ban_player(
        self, 
        discord_id: str, 
        reason: str, 
        duration: str,
        banned_by: str
    ) -> Tuple[bool, str]:
        """Ban a player for a specified duration."""
        try:
            # Parse duration
            expiry = self._parse_duration(duration)
            if not expiry:
                return False, "Invalid duration format. Use: 24h, 7d, 30d, or permanent"
            
            # Update user ban status
            await self.prisma.user.update(
                where={"discordId": discord_id},
                data={
                    "isBanned": True,
                    "banReason": reason,
                    "banExpiry": expiry
                }
            )
            
            # Create ban record
            await self.prisma.banrecord.create(
                data={
                    "userId": discord_id,
                    "reason": reason,
                    "bannedBy": banned_by,
                    "bannedAt": datetime.utcnow(),
                    "expiresAt": expiry,
                    "isActive": True
                }
            )
            
            logger.info(f"Player {discord_id} banned by {banned_by}: {reason} until {expiry}")
            return True, f"Player banned successfully until {expiry.strftime('%Y-%m-%d %H:%M UTC')}"
            
        except Exception as e:
            logger.error(f"Error banning player {discord_id}: {e}")
            return False, f"Failed to ban player: {str(e)}"
    
    async def unban_player(self, discord_id: str) -> Tuple[bool, str]:
        """Unban a player."""
        try:
            # Update user ban status
            await self.prisma.user.update(
                where={"discordId": discord_id},
                data={
                    "isBanned": False,
                    "banReason": None,
                    "banExpiry": None
                }
            )
            
            # Deactivate all active ban records
            await self.prisma.banrecord.update_many(
                where={"userId": discord_id, "isActive": True},
                data={"isActive": False}
            )
            
            logger.info(f"Player {discord_id} unbanned")
            return True, "Player unbanned successfully"
            
        except Exception as e:
            logger.error(f"Error unbanning player {discord_id}: {e}")
            return False, f"Failed to unban player: {str(e)}"
    
    async def is_player_banned(self, discord_id: str) -> Tuple[bool, Optional[str], Optional[datetime]]:
        """Check if a player is currently banned."""
        try:
            user = await self.prisma.user.find_unique(
                where={"discordId": discord_id},
                select={"isBanned": True, "banReason": True, "banExpiry": True}
            )
            
            if not user:
                return False, None, None
            
            # Check if ban has expired
            if user.isBanned and user.banExpiry and datetime.utcnow() > user.banExpiry:
                # Auto-unban expired bans
                await self.unban_player(discord_id)
                return False, None, None
            
            return user.isBanned, user.banReason, user.banExpiry
            
        except Exception as e:
            logger.error(f"Error checking ban status for {discord_id}: {e}")
            return False, None, None
    
    async def get_player_info(self, discord_id: str) -> Optional[dict]:
        """Get comprehensive player information including ban status."""
        try:
            user = await self.prisma.user.find_unique(
                where={"discordId": discord_id},
                select={
                    "username": True,
                    "address": True,
                    "totalMatches": True,
                    "totalWins": True,
                    "totalLosses": True,
                    "isBanned": True,
                    "banReason": True,
                    "banExpiry": True,
                    "createdAt": True
                }
            )
            
            if not user:
                return None
            
            # Get recent ban history
            ban_records = await self.prisma.banrecord.find_many(
                where={"userId": discord_id},
                order={"bannedAt": "desc"},
                take=5
            )
            
            return {
                **user.dict(),
                "banHistory": [
                    {
                        "reason": record.reason,
                        "bannedBy": record.bannedBy,
                        "bannedAt": record.bannedAt,
                        "expiresAt": record.expiresAt,
                        "isActive": record.isActive
                    }
                    for record in ban_records
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting player info for {discord_id}: {e}")
            return None
    
    async def get_banned_players(self) -> List[dict]:
        """Get list of currently banned players."""
        try:
            users = await self.prisma.user.find_many(
                where={"isBanned": True},
                select={
                    "discordId": True,
                    "username": True,
                    "banReason": True,
                    "banExpiry": True
                }
            )
            
            return [
                {
                    "discordId": user.discordId,
                    "username": user.username,
                    "banReason": user.banReason,
                    "banExpiry": user.banExpiry,
                    "isExpired": user.banExpiry and datetime.utcnow() > user.banExpiry
                }
                for user in users
            ]
            
        except Exception as e:
            logger.error(f"Error getting banned players: {e}")
            return []
    
    def _parse_duration(self, duration: str) -> Optional[datetime]:
        """Parse duration string into expiry datetime."""
        now = datetime.utcnow()
        
        if duration == "permanent":
            return None  # No expiry for permanent bans
        
        try:
            if duration.endswith("h"):
                hours = int(duration[:-1])
                return now + timedelta(hours=hours)
            elif duration.endswith("d"):
                days = int(duration[:-1])
                return now + timedelta(days=days)
            else:
                return None
        except ValueError:
            return None 