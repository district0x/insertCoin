"""Rate limiting configuration for the Discord bot."""

import os
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class RateLimitSettings:
    """Rate limiting configuration settings."""
    
    # Discord API Limits
    DISCORD_GLOBAL_LIMIT: int = 45  # Conservative limit (Discord allows 50/s)
    DISCORD_USER_LIMIT: int = 5     # Per-user requests per second
    DISCORD_BURST_LIMIT: int = 10   # Allow burst of requests
    DISCORD_RETRY_AFTER: float = 0.1  # Seconds to wait when rate limited
    
    # Database Limits
    DATABASE_MAX_CONNECTIONS: int = 20
    DATABASE_REQUEST_LIMIT: int = 100  # Database operations per second
    DATABASE_BURST_LIMIT: int = 20
    DATABASE_RETRY_AFTER: float = 0.05
    
    # Web3 Limits
    WEB3_REQUEST_LIMIT: int = 10    # Web3 calls per second (conservative)
    WEB3_BURST_LIMIT: int = 3
    WEB3_RETRY_AFTER: float = 0.2
    
    # ETH Price API Limits
    ETH_PRICE_CACHE_DURATION: int = 60  # Cache ETH price for 60 seconds
    ETH_PRICE_REQUEST_LIMIT: int = 5    # Price requests per minute
    
    # Match Creation Limits
    MATCH_CREATION_COOLDOWN: int = 30   # Seconds between match creations per user
    MAX_ACTIVE_MATCHES_PER_USER: int = 5  # Maximum active matches per user
    
    # Room Creation Limits
    ROOM_CREATION_COOLDOWN: int = 10    # Seconds between room creations per user
    MAX_ROOMS_PER_GUILD: int = 50       # Maximum rooms per Discord guild
    
    # Button Interaction Limits
    BUTTON_CLICK_COOLDOWN: int = 5      # Seconds between button clicks per user
    
    # Error Handling
    MAX_RETRIES: int = 3                # Maximum retries for failed operations
    RETRY_DELAY: float = 1.0            # Base delay between retries
    
    @classmethod
    def from_env(cls) -> 'RateLimitSettings':
        """Create settings from environment variables."""
        return cls(
            DISCORD_GLOBAL_LIMIT=int(os.getenv('DISCORD_GLOBAL_LIMIT', 45)),
            DISCORD_USER_LIMIT=int(os.getenv('DISCORD_USER_LIMIT', 5)),
            DISCORD_BURST_LIMIT=int(os.getenv('DISCORD_BURST_LIMIT', 10)),
            DISCORD_RETRY_AFTER=float(os.getenv('DISCORD_RETRY_AFTER', 0.1)),
            
            DATABASE_MAX_CONNECTIONS=int(os.getenv('DATABASE_MAX_CONNECTIONS', 20)),
            DATABASE_REQUEST_LIMIT=int(os.getenv('DATABASE_REQUEST_LIMIT', 100)),
            DATABASE_BURST_LIMIT=int(os.getenv('DATABASE_BURST_LIMIT', 20)),
            DATABASE_RETRY_AFTER=float(os.getenv('DATABASE_RETRY_AFTER', 0.05)),
            
            WEB3_REQUEST_LIMIT=int(os.getenv('WEB3_REQUEST_LIMIT', 10)),
            WEB3_BURST_LIMIT=int(os.getenv('WEB3_BURST_LIMIT', 3)),
            WEB3_RETRY_AFTER=float(os.getenv('WEB3_RETRY_AFTER', 0.2)),
            
            ETH_PRICE_CACHE_DURATION=int(os.getenv('ETH_PRICE_CACHE_DURATION', 60)),
            ETH_PRICE_REQUEST_LIMIT=int(os.getenv('ETH_PRICE_REQUEST_LIMIT', 5)),
            
            MATCH_CREATION_COOLDOWN=int(os.getenv('MATCH_CREATION_COOLDOWN', 30)),
            MAX_ACTIVE_MATCHES_PER_USER=int(os.getenv('MAX_ACTIVE_MATCHES_PER_USER', 5)),
            
            ROOM_CREATION_COOLDOWN=int(os.getenv('ROOM_CREATION_COOLDOWN', 10)),
            MAX_ROOMS_PER_GUILD=int(os.getenv('MAX_ROOMS_PER_GUILD', 50)),
            
            BUTTON_CLICK_COOLDOWN=int(os.getenv('BUTTON_CLICK_COOLDOWN', 5)),
            
            MAX_RETRIES=int(os.getenv('MAX_RETRIES', 3)),
            RETRY_DELAY=float(os.getenv('RETRY_DELAY', 1.0))
        )

# Global settings instance
SETTINGS = RateLimitSettings.from_env()

# Environment-specific overrides
def get_settings_for_environment(env: str = None) -> RateLimitSettings:
    """Get rate limiting settings for specific environment."""
    if env == "production":
        return RateLimitSettings(
            DISCORD_GLOBAL_LIMIT=40,  # More conservative in production
            DISCORD_USER_LIMIT=3,     # Stricter per-user limits
            DATABASE_MAX_CONNECTIONS=30,  # More connections for production
            WEB3_REQUEST_LIMIT=8,     # More conservative Web3 limits
            MATCH_CREATION_COOLDOWN=60,   # Longer cooldown in production
        )
    elif env == "development":
        return RateLimitSettings(
            DISCORD_GLOBAL_LIMIT=50,  # More lenient in development
            DISCORD_USER_LIMIT=10,    # Higher limits for testing
            DATABASE_MAX_CONNECTIONS=10,  # Fewer connections for development
            WEB3_REQUEST_LIMIT=15,    # Higher Web3 limits for testing
            MATCH_CREATION_COOLDOWN=10,   # Shorter cooldown for testing
        )
    else:
        return SETTINGS

# Rate limiting recommendations for different user counts
RATE_LIMIT_RECOMMENDATIONS = {
    "10_users": {
        "description": "Small community (10 users)",
        "settings": RateLimitSettings(
            DISCORD_GLOBAL_LIMIT=30,
            DISCORD_USER_LIMIT=10,
            DATABASE_MAX_CONNECTIONS=10,
            WEB3_REQUEST_LIMIT=15,
            MATCH_CREATION_COOLDOWN=15
        )
    },
    "50_users": {
        "description": "Medium community (50 users)",
        "settings": RateLimitSettings(
            DISCORD_GLOBAL_LIMIT=40,
            DISCORD_USER_LIMIT=5,
            DATABASE_MAX_CONNECTIONS=20,
            WEB3_REQUEST_LIMIT=10,
            MATCH_CREATION_COOLDOWN=30
        )
    },
    "200_users": {
        "description": "Large community (200 users)",
        "settings": RateLimitSettings(
            DISCORD_GLOBAL_LIMIT=45,
            DISCORD_USER_LIMIT=3,
            DATABASE_MAX_CONNECTIONS=30,
            WEB3_REQUEST_LIMIT=8,
            MATCH_CREATION_COOLDOWN=60
        )
    },
    "1000_users": {
        "description": "Very large community (1000+ users)",
        "settings": RateLimitSettings(
            DISCORD_GLOBAL_LIMIT=45,
            DISCORD_USER_LIMIT=2,
            DATABASE_MAX_CONNECTIONS=50,
            WEB3_REQUEST_LIMIT=5,
            MATCH_CREATION_COOLDOWN=120
        )
    }
}

def get_recommended_settings(user_count: int) -> RateLimitSettings:
    """Get recommended rate limiting settings based on user count."""
    if user_count <= 10:
        return RATE_LIMIT_RECOMMENDATIONS["10_users"]["settings"]
    elif user_count <= 50:
        return RATE_LIMIT_RECOMMENDATIONS["50_users"]["settings"]
    elif user_count <= 200:
        return RATE_LIMIT_RECOMMENDATIONS["200_users"]["settings"]
    else:
        return RATE_LIMIT_RECOMMENDATIONS["1000_users"]["settings"]

# Monitoring thresholds
MONITORING_THRESHOLDS = {
    "warning": {
        "rate_limit_percentage": 50,  # Warn when 50% of requests are rate limited
        "database_connections": 15,   # Warn when 15+ database connections active
        "discord_errors": 10,         # Warn when 10+ Discord errors per minute
        "web3_errors": 5              # Warn when 5+ Web3 errors per minute
    },
    "critical": {
        "rate_limit_percentage": 80,  # Critical when 80% of requests are rate limited
        "database_connections": 25,   # Critical when 25+ database connections active
        "discord_errors": 30,         # Critical when 30+ Discord errors per minute
        "web3_errors": 15             # Critical when 15+ Web3 errors per minute
    }
} 