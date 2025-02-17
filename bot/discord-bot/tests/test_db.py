from pathlib import Path
import os

from dotenv import load_dotenv
from prisma import Prisma

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

def main() -> None:
    # Initialize Prisma client
    db = Prisma()
    db.connect()
    
    try:
        print("Testing database connection...")
        
        # Create a test user
        test_user = db.user.create(
            data={
                'username': 'test_user',
                'discordId': '123456789',
                'address': '0x123456789',
                'totalMatches': 0,
                'totalWins': 0,
                'totalLosses': 0
            }
        )
        print(f"Created test user: {test_user.username}")
        
        # Query the user back
        found_user = db.user.find_first(
            where={
                'username': 'test_user'
            }
        )
        print(f"Found user: {found_user.username if found_user else 'Not found'}")
        
        # Clean up - delete the test user
        deleted_user = db.user.delete(
            where={
                'username': 'test_user'
            }
        )
        print(f"Deleted test user: {deleted_user.username}")
        
        print("All tests passed successfully!")
        
    except Exception as e:
        print(f"Error during testing: {e}")
        raise
    finally:
        db.disconnect()
        print("Disconnected from database")

if __name__ == '__main__':
    main() 