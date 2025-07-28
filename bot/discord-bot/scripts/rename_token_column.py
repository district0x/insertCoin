#!/usr/bin/env python3
"""
Migration script to rename tokenAddress column to tokenName in the Match table.
This preserves all existing data while updating the column name.
"""

import asyncio
import logging
import sys
import os

# Add the src directory to the path so we can import the bot modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from db.prisma import prisma

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def rename_token_column():
    """Rename tokenAddress column to tokenName in the Match table."""
    try:
        await prisma.connect()
        logger.info("Connected to database")
        
        # Check if the column exists
        result = await prisma.query_raw("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'Match' AND column_name = 'tokenAddress'
        """)
        
        if not result:
            logger.warning("Column 'tokenAddress' not found. It may have already been renamed.")
            return
        
        # Rename the column
        logger.info("Renaming tokenAddress column to tokenName...")
        await prisma.execute_raw("""
            ALTER TABLE "Match" RENAME COLUMN "tokenAddress" TO "tokenName"
        """)
        
        logger.info("✅ Successfully renamed tokenAddress to tokenName")
        
        # Verify the change
        result = await prisma.query_raw("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'Match' AND column_name = 'tokenName'
        """)
        
        if result:
            logger.info("✅ Column rename verified successfully")
        else:
            logger.error("❌ Column rename verification failed")
            
    except Exception as e:
        logger.error(f"❌ Error during migration: {e}")
        raise
    finally:
        await prisma.disconnect()
        logger.info("Disconnected from database")

if __name__ == "__main__":
    asyncio.run(rename_token_column()) 