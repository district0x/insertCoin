import asyncio
from src.db.prisma import prisma
from src.utils.config import config

def check_database():
    try:
        # Connect using the same config as the bot
        prisma.connect(config.DATABASE_URL)
        print("Connected to database")
        
        # Get all users
        users = prisma.user.find_many()
        print(f"\nFound {len(users)} users in database:")
        
        for user in users:
            print(f"ID: {user.id}")
            print(f"  Discord ID: {user.discordId}")
            print(f"  Wallet: {user.address}")
            print(f"  Username: {user.username}")
            print("---")
            
        # Check verification transactions
        verifications = prisma.verificationTransaction.find_many()
        print(f"\nFound {len(verifications)} verification transactions:")
        
        for v in verifications:
            print(f"TX Hash: {v.txHash}")
            print(f"  Discord ID: {v.discordId}")
            print(f"  Wallet: {v.walletAddress}")
            print(f"  Status: {v.status}")
            print("---")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        prisma.disconnect()
        print("Disconnected from database")

if __name__ == "__main__":
    check_database() 