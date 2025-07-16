"""Rate limiting utilities for Discord bot operations."""

import asyncio
import time
import logging
from typing import Dict, Optional, Callable, Any
from collections import defaultdict, deque
from dataclasses import dataclass
from functools import wraps
import aiohttp
import discord
from discord.ext import commands

logger = logging.getLogger(__name__)

@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    max_requests: int
    time_window: float  # in seconds
    burst_limit: int = 5  # allow burst of requests
    retry_after: float = 1.0  # seconds to wait when rate limited

class RateLimiter:
    """Rate limiter for managing API calls."""
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.requests = deque()
        self.last_reset = time.time()
        
    def is_allowed(self) -> bool:
        """Check if request is allowed."""
        now = time.time()
        
        # Reset window if needed
        if now - self.last_reset > self.config.time_window:
            self.requests.clear()
            self.last_reset = now
            
        # Remove old requests outside window
        while self.requests and now - self.requests[0] > self.config.time_window:
            self.requests.popleft()
            
        # Check if under limit
        return len(self.requests) < self.config.max_requests
        
    def add_request(self):
        """Add a request to the queue."""
        self.requests.append(time.time())
        
    async def wait_if_needed(self):
        """Wait if rate limited."""
        if not self.is_allowed():
            wait_time = self.config.retry_after
            logger.warning(f"Rate limited, waiting {wait_time}s")
            await asyncio.sleep(wait_time)
        self.add_request()

# Global rate limiters
DISCORD_RATE_LIMITER = RateLimiter(RateLimitConfig(
    max_requests=45,  # Conservative limit (Discord allows 50/s)
    time_window=1.0,
    burst_limit=10,
    retry_after=0.1
))

DATABASE_RATE_LIMITER = RateLimiter(RateLimitConfig(
    max_requests=100,  # Database operations
    time_window=1.0,
    burst_limit=20,
    retry_after=0.05
))

WEB3_RATE_LIMITER = RateLimiter(RateLimitConfig(
    max_requests=10,  # Web3 calls (more conservative)
    time_window=1.0,
    burst_limit=3,
    retry_after=0.2
))

# Per-user rate limiters
USER_RATE_LIMITERS: Dict[str, RateLimiter] = defaultdict(
    lambda: RateLimiter(RateLimitConfig(
        max_requests=5,  # 5 requests per user per second
        time_window=1.0,
        burst_limit=2,
        retry_after=0.5
    ))
)

def rate_limit(limiter: RateLimiter, user_specific: bool = False):
    """Decorator for rate limiting functions."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get user ID if user-specific
            user_id = None
            if user_specific and args:
                interaction = args[0]
                if hasattr(interaction, 'user') and hasattr(interaction.user, 'id'):
                    user_id = str(interaction.user.id)
            
            # Apply rate limiting
            if user_id:
                await USER_RATE_LIMITERS[user_id].wait_if_needed()
            await limiter.wait_if_needed()
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

class DatabaseConnectionPool:
    """Connection pool for database operations."""
    
    def __init__(self, max_connections: int = 20):
        self.max_connections = max_connections
        self.active_connections = 0
        self.semaphore = asyncio.Semaphore(max_connections)
        
    async def acquire(self):
        """Acquire a database connection."""
        await self.semaphore.acquire()
        self.active_connections += 1
        logger.debug(f"Database connection acquired. Active: {self.active_connections}")
        
    def release(self):
        """Release a database connection."""
        self.semaphore.release()
        self.active_connections -= 1
        logger.debug(f"Database connection released. Active: {self.active_connections}")

# Global connection pool
DB_POOL = DatabaseConnectionPool(max_connections=20)

class Web3Client:
    """Rate-limited Web3 client."""
    
    def __init__(self, rpc_url: str):
        self.rpc_url = rpc_url
        self.session = None
        self.request_id = 0
        
    async def get_session(self):
        """Get or create aiohttp session."""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
        
    async def make_request(self, method: str, params: list = None) -> dict:
        """Make rate-limited Web3 request."""
        await WEB3_RATE_LIMITER.wait_if_needed()
        
        session = await self.get_session()
        self.request_id += 1
        
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or [],
            "id": self.request_id
        }
        
        try:
            async with session.post(self.rpc_url, json=payload) as response:
                if response.status == 429:  # Rate limited
                    logger.warning("Web3 provider rate limited, waiting...")
                    await asyncio.sleep(1.0)
                    return await self.make_request(method, params)
                    
                result = await response.json()
                if "error" in result:
                    logger.error(f"Web3 error: {result['error']}")
                    raise Exception(f"Web3 error: {result['error']}")
                    
                return result.get("result")
                
        except Exception as e:
            logger.error(f"Web3 request failed: {e}")
            raise

class DiscordRateLimitHandler:
    """Handle Discord-specific rate limiting."""
    
    @staticmethod
    async def handle_rate_limit(interaction: discord.Interaction, retry_func: Callable, max_retries: int = 3):
        """Handle Discord rate limits with retries."""
        for attempt in range(max_retries):
            try:
                await DISCORD_RATE_LIMITER.wait_if_needed()
                return await retry_func()
                
            except discord.HTTPException as e:
                if e.status == 429:  # Rate limited
                    retry_after = e.retry_after or 1.0
                    logger.warning(f"Discord rate limited, waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    continue
                else:
                    raise
                    
        raise Exception("Max retries exceeded for Discord operation")

# Utility functions for common operations
async def rate_limited_db_operation(operation: Callable, *args, **kwargs):
    """Execute database operation with rate limiting."""
    await DATABASE_RATE_LIMITER.wait_if_needed()
    await DB_POOL.acquire()
    
    try:
        return await operation(*args, **kwargs)
    finally:
        DB_POOL.release()

async def rate_limited_discord_operation(operation: Callable, *args, **kwargs):
    """Execute Discord operation with rate limiting."""
    await DISCORD_RATE_LIMITER.wait_if_needed()
    return await operation(*args, **kwargs)

# Monitoring and metrics
class RateLimitMetrics:
    """Track rate limiting metrics."""
    
    def __init__(self):
        self.total_requests = 0
        self.rate_limited_requests = 0
        self.discord_limits = 0
        self.database_limits = 0
        self.web3_limits = 0
        
    def record_request(self, limiter_type: str, was_limited: bool):
        """Record a request."""
        self.total_requests += 1
        if was_limited:
            self.rate_limited_requests += 1
            if limiter_type == "discord":
                self.discord_limits += 1
            elif limiter_type == "database":
                self.database_limits += 1
            elif limiter_type == "web3":
                self.web3_limits += 1
                
    def get_stats(self) -> dict:
        """Get current statistics."""
        return {
            "total_requests": self.total_requests,
            "rate_limited_requests": self.rate_limited_requests,
            "discord_limits": self.discord_limits,
            "database_limits": self.database_limits,
            "web3_limits": self.web3_limits,
            "limit_percentage": (self.rate_limited_requests / max(self.total_requests, 1)) * 100
        }

# Global metrics
METRICS = RateLimitMetrics()

# Command to view rate limiting stats
async def get_rate_limit_stats(interaction: discord.Interaction):
    """Get rate limiting statistics."""
    stats = METRICS.get_stats()
    
    embed = discord.Embed(
        title="📊 Rate Limiting Statistics",
        description="Current API usage and rate limiting stats",
        color=discord.Color.blue()
    )
    
    embed.add_field(
        name="Total Requests",
        value=f"{stats['total_requests']:,}",
        inline=True
    )
    
    embed.add_field(
        name="Rate Limited",
        value=f"{stats['rate_limited_requests']:,} ({stats['limit_percentage']:.1f}%)",
        inline=True
    )
    
    embed.add_field(
        name="Discord Limits",
        value=f"{stats['discord_limits']:,}",
        inline=True
    )
    
    embed.add_field(
        name="Database Limits",
        value=f"{stats['database_limits']:,}",
        inline=True
    )
    
    embed.add_field(
        name="Web3 Limits",
        value=f"{stats['web3_limits']:,}",
        inline=True
    )
    
    await interaction.response.send_message(embed=embed, ephemeral=True) 