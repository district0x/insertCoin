#!/usr/bin/env python3
"""
Database cleanup script to ensure 1:1 Discord ID to wallet mapping.
This script identifies and fixes any duplicate mappings in the database.
"""

import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv
from prisma import Prisma

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DatabaseCleanup:
    def __init__(self):
        self.prisma = Prisma()
        
    async def connect(self):
        """Connect to the database."""
        await self.prisma.connect()
        logger.info("Connected to database")
        
    async def disconnect(self):
        """Disconnect from the database."""
        await self.prisma.disconnect()
        logger.info("Disconnected from database")
        
    async def find_duplicate_discord_ids(self) -> List[Dict[str, Any]]:
        """Find users with duplicate Discord IDs."""
        logger.info("Checking for duplicate Discord IDs...")
        
        # Get all users with Discord IDs
        users_with_discord = await self.prisma.user.find_many(
            where={"discordId": {"not": None}},
            order={"discordId": "asc"}
        )
        
        # Group by Discord ID
        discord_groups = {}
        for user in users_with_discord:
            discord_id = user.discordId
            if discord_id not in discord_groups:
                discord_groups[discord_id] = []
            discord_groups[discord_id].append(user)
        
        # Find duplicates
        duplicates = []
        for discord_id, users in discord_groups.items():
            if len(users) > 1:
                duplicates.append({
                    "discordId": discord_id,
                    "users": users
                })
                
        logger.info(f"Found {len(duplicates)} Discord IDs with duplicates")
        return duplicates
        
    async def find_duplicate_wallets(self) -> List[Dict[str, Any]]:
        """Find users with duplicate wallet addresses."""
        logger.info("Checking for duplicate wallet addresses...")
        
        # Get all users with wallet addresses
        users_with_wallet = await self.prisma.user.find_many(
            where={"address": {"not": None}},
            order={"address": "asc"}
        )
        
        # Group by wallet address
        wallet_groups = {}
        for user in users_with_wallet:
            wallet = user.address
            if wallet not in wallet_groups:
                wallet_groups[wallet] = []
            wallet_groups[wallet].append(user)
        
        # Find duplicates
        duplicates = []
        for wallet, users in wallet_groups.items():
            if len(users) > 1:
                duplicates.append({
                    "wallet": wallet,
                    "users": users
                })
                
        logger.info(f"Found {len(duplicates)} wallet addresses with duplicates")
        return duplicates
        
    async def fix_discord_duplicates(self, duplicates: List[Dict[str, Any]]) -> int:
        """Fix duplicate Discord ID mappings by keeping the most recent user."""
        fixed_count = 0
        
        for duplicate in duplicates:
            discord_id = duplicate["discordId"]
            users = duplicate["users"]
            
            logger.info(f"Fixing duplicate Discord ID: {discord_id}")
            logger.info(f"  Found {len(users)} users with this Discord ID")
            
            # Sort by creation date (newest first)
            users.sort(key=lambda u: u.createdAt, reverse=True)
            
            # Keep the newest user, unlink the others
            keep_user = users[0]
            users_to_unlink = users[1:]
            
            logger.info(f"  Keeping user {keep_user.id} (created: {keep_user.createdAt})")
            
            for user in users_to_unlink:
                logger.info(f"  Unlinking Discord ID from user {user.id}")
                await self.prisma.user.update(
                    where={"id": user.id},
                    data={"discordId": None}
                )
                fixed_count += 1
                
        return fixed_count
        
    async def fix_wallet_duplicates(self, duplicates: List[Dict[str, Any]]) -> int:
        """Fix duplicate wallet mappings by keeping the most recent user."""
        fixed_count = 0
        
        for duplicate in duplicates:
            wallet = duplicate["wallet"]
            users = duplicate["users"]
            
            logger.info(f"Fixing duplicate wallet: {wallet[:6]}...{wallet[-4:]}")
            logger.info(f"  Found {len(users)} users with this wallet")
            
            # Sort by creation date (newest first)
            users.sort(key=lambda u: u.createdAt, reverse=True)
            
            # Keep the newest user, remove wallet from others
            keep_user = users[0]
            users_to_unlink = users[1:]
            
            logger.info(f"  Keeping user {keep_user.id} (created: {keep_user.createdAt})")
            
            for user in users_to_unlink:
                logger.info(f"  Removing wallet from user {user.id}")
                await self.prisma.user.update(
                    where={"id": user.id},
                    data={"address": None}
                )
                fixed_count += 1
                
        return fixed_count
        
    async def find_orphaned_users(self) -> List[Dict[str, Any]]:
        """Find users without Discord ID or wallet address."""
        logger.info("Checking for orphaned users...")
        
        orphaned = await self.prisma.user.find_many(
            where={
                "AND": [
                    {"discordId": None},
                    {"address": None}
                ]
            }
        )
        
        logger.info(f"Found {len(orphaned)} orphaned users")
        return orphaned
        
    async def cleanup_orphaned_users(self, orphaned: List[Dict[str, Any]]) -> int:
        """Remove orphaned users (no Discord ID and no wallet)."""
        deleted_count = 0
        
        for user in orphaned:
            logger.info(f"Deleting orphaned user {user.id}")
            await self.prisma.user.delete(where={"id": user.id})
            deleted_count += 1
            
        return deleted_count
        
    async def generate_report(self) -> Dict[str, Any]:
        """Generate a comprehensive cleanup report."""
        logger.info("Generating cleanup report...")
        
        # Get total counts
        total_users = await self.prisma.user.count()
        users_with_discord = await self.prisma.user.count(where={"discordId": {"not": None}})
        users_with_wallet = await self.prisma.user.count(where={"address": {"not": None}})
        users_with_both = await self.prisma.user.count(
            where={
                "AND": [
                    {"discordId": {"not": None}},
                    {"address": {"not": None}}
                ]
            }
        )
        
        report = {
            "total_users": total_users,
            "users_with_discord": users_with_discord,
            "users_with_wallet": users_with_wallet,
            "users_with_both": users_with_both,
            "discord_duplicates": [],
            "wallet_duplicates": [],
            "orphaned_users": []
        }
        
        # Check for duplicates
        discord_duplicates = await self.find_duplicate_discord_ids()
        wallet_duplicates = await self.find_duplicate_wallets()
        orphaned = await self.find_orphaned_users()
        
        report["discord_duplicates"] = discord_duplicates
        report["wallet_duplicates"] = wallet_duplicates
        report["orphaned_users"] = orphaned
        
        return report
        
    async def run_cleanup(self, dry_run: bool = True) -> Dict[str, Any]:
        """Run the complete cleanup process."""
        logger.info(f"Starting database cleanup (dry_run: {dry_run})")
        
        # Generate initial report
        report = await self.generate_report()
        
        if dry_run:
            logger.info("DRY RUN - No changes will be made")
            return report
            
        # Fix duplicates
        discord_fixed = await self.fix_discord_duplicates(report["discord_duplicates"])
        wallet_fixed = await self.fix_wallet_duplicates(report["wallet_duplicates"])
        orphaned_deleted = await self.cleanup_orphaned_users(report["orphaned_users"])
        
        # Generate final report
        final_report = await self.generate_report()
        final_report["cleanup_results"] = {
            "discord_duplicates_fixed": discord_fixed,
            "wallet_duplicates_fixed": wallet_fixed,
            "orphaned_users_deleted": orphaned_deleted
        }
        
        logger.info("Cleanup completed successfully")
        return final_report

async def main():
    """Main function to run the cleanup."""
    cleanup = DatabaseCleanup()
    
    try:
        await cleanup.connect()
        
        # First run a dry run to see what needs to be fixed
        logger.info("=== DRY RUN ===")
        dry_run_report = await cleanup.run_cleanup(dry_run=True)
        
        print("\n" + "="*50)
        print("DRY RUN REPORT")
        print("="*50)
        print(f"Total Users: {dry_run_report['total_users']}")
        print(f"Users with Discord ID: {dry_run_report['users_with_discord']}")
        print(f"Users with Wallet: {dry_run_report['users_with_wallet']}")
        print(f"Users with Both: {dry_run_report['users_with_both']}")
        print(f"Discord Duplicates: {len(dry_run_report['discord_duplicates'])}")
        print(f"Wallet Duplicates: {len(dry_run_report['wallet_duplicates'])}")
        print(f"Orphaned Users: {len(dry_run_report['orphaned_users'])}")
        
        if (len(dry_run_report['discord_duplicates']) > 0 or 
            len(dry_run_report['wallet_duplicates']) > 0 or 
            len(dry_run_report['orphaned_users']) > 0):
            
            print("\n" + "="*50)
            print("ISSUES FOUND - Would you like to fix them?")
            print("="*50)
            
            # In a real scenario, you might want to ask for confirmation
            # For now, we'll just show what would be fixed
            print("To fix these issues, run with dry_run=False")
            
        else:
            print("\n✅ No issues found! Database is clean.")
            
    except Exception as e:
        logger.error(f"Error during cleanup: {e}", exc_info=True)
        raise
    finally:
        await cleanup.disconnect()

if __name__ == "__main__":
    asyncio.run(main()) 