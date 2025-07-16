import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class Config:
    """Configuration class for the bot."""
    
    # Discord configuration
    DISCORD_TOKEN: str = os.getenv('DISCORD_TOKEN', '')
    DISCORD_GUILD_ID: Optional[int] = int(os.getenv('DISCORD_GUILD_ID', 0)) or None
    COMMAND_PREFIX: str = os.getenv('COMMAND_PREFIX', '!')
    
    # Database configuration
    DATABASE_URL: str = os.getenv('DATABASE_URL', '')
    DIRECT_URL: str = os.getenv('DIRECT_URL', '')
    
    # Blockchain configuration
    RPC_URL: str = os.getenv('RPC_URL', '')
    CONTRACT_ADDRESS: str = os.getenv('CONTRACT_ADDRESS', '')
    
    # Frontend configuration
    FRONTEND_URL: str = os.getenv('FRONTEND_URL', '')
    
    # Logging configuration
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    
    @classmethod
    def validate(cls) -> bool:
        """Validate required configuration values."""
        required_values = [
            ('DISCORD_TOKEN', cls.DISCORD_TOKEN),
            ('DATABASE_URL', cls.DATABASE_URL),
            ('RPC_URL', cls.RPC_URL),
            ('CONTRACT_ADDRESS', cls.CONTRACT_ADDRESS),
            ('FRONTEND_URL', cls.FRONTEND_URL)
        ]
        
        missing_values = [name for name, value in required_values if not value]
        
        if missing_values:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing_values)}"
            )
            
        return True
        
    @classmethod
    def get_frontend_url(cls, path: str = '') -> str:
        """Get frontend URL with optional path."""
        return f"{cls.FRONTEND_URL.rstrip('/')}/{path.lstrip('/')}"
        
    @classmethod
    def get_match_url(cls, match_id: str) -> str:
        """Get match URL."""
        return cls.get_frontend_url(f"match/{match_id}")
        
    @classmethod
    def get_tournament_url(cls, tournament_id: str) -> str:
        """Get tournament URL."""
        return cls.get_frontend_url(f"tournament/{tournament_id}")
        
config = Config()
