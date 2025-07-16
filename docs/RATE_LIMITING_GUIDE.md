# Rate Limiting Guide for OneVOne Discord Bot

## Overview

This guide explains the rate limiting system implemented to handle concurrent users efficiently and prevent API overload. The system is designed to handle **50+ concurrent users** creating matches simultaneously while maintaining optimal performance.

## Architecture

### Rate Limiting Components

```typescript
// Rate Limiting Layers
1. Discord API Rate Limiting     // 45 requests/second (conservative)
2. Database Connection Pooling   // 20 concurrent connections
3. Web3 API Rate Limiting       // 10 requests/second
4. Per-User Rate Limiting       // 5 requests/second per user
5. Operation-Specific Limits    // Match creation, room creation, etc.
```

### Key Features

- ✅ **Multi-layer protection** - Discord, Database, Web3, User levels
- ✅ **Automatic retries** - Handles temporary rate limits gracefully
- ✅ **Connection pooling** - Efficient database resource management
- ✅ **Real-time monitoring** - Track rate limiting statistics
- ✅ **Configurable limits** - Adjust based on user count and needs
- ✅ **Graceful degradation** - Continues working under load

## Rate Limits by Component

### 1. Discord API Limits

```python
# Discord Rate Limiting
DISCORD_GLOBAL_LIMIT = 45      # requests/second (Discord allows 50/s)
DISCORD_USER_LIMIT = 5         # requests/second per user
DISCORD_BURST_LIMIT = 10       # allow burst of requests
DISCORD_RETRY_AFTER = 0.1      # seconds to wait when rate limited
```

**What this protects:**
- Channel creation
- Message sending
- User fetching
- Button interactions
- Embed creation

### 2. Database Connection Pooling

```python
# Database Limits
DATABASE_MAX_CONNECTIONS = 20   # concurrent database connections
DATABASE_REQUEST_LIMIT = 100    # operations per second
DATABASE_BURST_LIMIT = 20       # allow burst of operations
DATABASE_RETRY_AFTER = 0.05     # seconds to wait when limited
```

**What this protects:**
- Match creation
- User statistics
- Room management
- Data queries

### 3. Web3 API Limits

```python
# Web3 Rate Limiting
WEB3_REQUEST_LIMIT = 10         # requests/second (conservative)
WEB3_BURST_LIMIT = 3            # allow burst of requests
WEB3_RETRY_AFTER = 0.2          # seconds to wait when rate limited
```

**What this protects:**
- ETH price fetching
- Contract interactions
- Transaction monitoring

### 4. Per-User Limits

```python
# Per-User Rate Limiting
USER_REQUEST_LIMIT = 5          # requests/second per user
USER_BURST_LIMIT = 2            # allow burst of requests
USER_RETRY_AFTER = 0.5          # seconds to wait when limited
```

**What this protects:**
- Spam prevention
- Resource abuse
- Fair usage

## Configuration by User Count

### Small Community (10 users)
```python
DISCORD_GLOBAL_LIMIT = 30
DISCORD_USER_LIMIT = 10
DATABASE_MAX_CONNECTIONS = 10
WEB3_REQUEST_LIMIT = 15
MATCH_CREATION_COOLDOWN = 15    # seconds
```

### Medium Community (50 users)
```python
DISCORD_GLOBAL_LIMIT = 40
DISCORD_USER_LIMIT = 5
DATABASE_MAX_CONNECTIONS = 20
WEB3_REQUEST_LIMIT = 10
MATCH_CREATION_COOLDOWN = 30    # seconds
```

### Large Community (200 users)
```python
DISCORD_GLOBAL_LIMIT = 45
DISCORD_USER_LIMIT = 3
DATABASE_MAX_CONNECTIONS = 30
WEB3_REQUEST_LIMIT = 8
MATCH_CREATION_COOLDOWN = 60    # seconds
```

### Very Large Community (1000+ users)
```python
DISCORD_GLOBAL_LIMIT = 45
DISCORD_USER_LIMIT = 2
DATABASE_MAX_CONNECTIONS = 50
WEB3_REQUEST_LIMIT = 5
MATCH_CREATION_COOLDOWN = 120   # seconds
```

## Implementation Details

### Rate Limiter Class

```python
class RateLimiter:
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.requests = deque()  # Sliding window
        self.last_reset = time.time()
    
    async def wait_if_needed(self):
        """Wait if rate limited, then add request."""
        if not self.is_allowed():
            await asyncio.sleep(self.config.retry_after)
        self.add_request()
```

### Database Connection Pool

```python
class DatabaseConnectionPool:
    def __init__(self, max_connections: int = 20):
        self.semaphore = asyncio.Semaphore(max_connections)
    
    async def acquire(self):
        """Acquire a database connection."""
        await self.semaphore.acquire()
    
    def release(self):
        """Release a database connection."""
        self.semaphore.release()
```

### Decorator Usage

```python
@rate_limit(DISCORD_RATE_LIMITER, user_specific=True)
async def handle_create_match(interaction: discord.Interaction, ...):
    """Rate-limited match creation."""
    # Function implementation
```

## Monitoring and Metrics

### Rate Limiting Statistics

Use the `/rate-limits` command (admin only) to view:

```python
# Metrics tracked
- Total requests
- Rate limited requests
- Discord API limits
- Database limits
- Web3 limits
- Limit percentage
```

### Monitoring Thresholds

```python
# Warning thresholds
WARNING_THRESHOLDS = {
    "rate_limit_percentage": 50,  # Warn at 50% rate limiting
    "database_connections": 15,   # Warn at 15+ connections
    "discord_errors": 10,         # Warn at 10+ errors/minute
    "web3_errors": 5              # Warn at 5+ errors/minute
}

# Critical thresholds
CRITICAL_THRESHOLDS = {
    "rate_limit_percentage": 80,  # Critical at 80% rate limiting
    "database_connections": 25,   # Critical at 25+ connections
    "discord_errors": 30,         # Critical at 30+ errors/minute
    "web3_errors": 15             # Critical at 15+ errors/minute
}
```

## Environment Configuration

### Environment Variables

```bash
# Discord Rate Limiting
DISCORD_GLOBAL_LIMIT=45
DISCORD_USER_LIMIT=5
DISCORD_BURST_LIMIT=10
DISCORD_RETRY_AFTER=0.1

# Database Rate Limiting
DATABASE_MAX_CONNECTIONS=20
DATABASE_REQUEST_LIMIT=100
DATABASE_BURST_LIMIT=20
DATABASE_RETRY_AFTER=0.05

# Web3 Rate Limiting
WEB3_REQUEST_LIMIT=10
WEB3_BURST_LIMIT=3
WEB3_RETRY_AFTER=0.2

# Operation Limits
MATCH_CREATION_COOLDOWN=30
MAX_ACTIVE_MATCHES_PER_USER=5
ROOM_CREATION_COOLDOWN=10
BUTTON_CLICK_COOLDOWN=5
```

### Environment-Specific Settings

```python
# Development (more lenient)
DISCORD_GLOBAL_LIMIT = 50
DISCORD_USER_LIMIT = 10
MATCH_CREATION_COOLDOWN = 10

# Production (more conservative)
DISCORD_GLOBAL_LIMIT = 40
DISCORD_USER_LIMIT = 3
MATCH_CREATION_COOLDOWN = 60
```

## Performance Optimization

### Caching Strategies

```python
# ETH Price Caching
ETH_PRICE_CACHE_DURATION = 60   # Cache for 60 seconds
ETH_PRICE_REQUEST_LIMIT = 5     # Max 5 requests per minute

# User Data Caching
USER_CACHE_DURATION = 300       # Cache user data for 5 minutes
MATCH_CACHE_DURATION = 60       # Cache match data for 1 minute
```

### Connection Reuse

```python
# Web3 Session Reuse
session = aiohttp.ClientSession()  # Reuse session
# Automatically handles connection pooling

# Database Connection Pooling
# Prisma automatically handles connection pooling
# Max 20 concurrent connections
```

## Error Handling

### Retry Logic

```python
# Automatic retries for rate limits
MAX_RETRIES = 3
RETRY_DELAY = 1.0

# Exponential backoff
retry_delay = RETRY_DELAY * (2 ** attempt)
```

### Graceful Degradation

```python
# When rate limited:
1. Wait for retry_after period
2. Retry operation
3. If still rate limited, increase wait time
4. After max retries, return error to user
```

## Testing Rate Limits

### Load Testing

```python
# Test with multiple concurrent users
import asyncio

async def test_concurrent_users(num_users: int):
    tasks = []
    for i in range(num_users):
        task = asyncio.create_task(simulate_user_activity())
        tasks.append(task)
    
    await asyncio.gather(*tasks)
```

### Monitoring During Load

```bash
# Check rate limiting stats
/rate-limits

# Monitor logs for rate limiting
tail -f bot.log | grep "Rate limited"

# Check database connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_db';
```

## Troubleshooting

### Common Issues

**1. High Rate Limiting Percentage**
```python
# Solution: Increase limits or add caching
DISCORD_GLOBAL_LIMIT = 50  # Increase from 45
ETH_PRICE_CACHE_DURATION = 120  # Cache longer
```

**2. Database Connection Exhaustion**
```python
# Solution: Increase connection pool
DATABASE_MAX_CONNECTIONS = 30  # Increase from 20
```

**3. Web3 API Rate Limiting**
```python
# Solution: Add more RPC providers or increase limits
WEB3_REQUEST_LIMIT = 15  # Increase from 10
# Add fallback RPC URLs
```

### Performance Tuning

**For 50 concurrent users:**
```python
# Recommended settings
DISCORD_GLOBAL_LIMIT = 40
DISCORD_USER_LIMIT = 5
DATABASE_MAX_CONNECTIONS = 20
WEB3_REQUEST_LIMIT = 10
MATCH_CREATION_COOLDOWN = 30
```

**For 200 concurrent users:**
```python
# Recommended settings
DISCORD_GLOBAL_LIMIT = 45
DISCORD_USER_LIMIT = 3
DATABASE_MAX_CONNECTIONS = 30
WEB3_REQUEST_LIMIT = 8
MATCH_CREATION_COOLDOWN = 60
```

## Best Practices

### 1. Monitor Regularly
- Check `/rate-limits` command daily
- Monitor error logs for rate limiting
- Track user experience during peak times

### 2. Scale Gradually
- Start with conservative limits
- Increase based on actual usage patterns
- Monitor performance impact of changes

### 3. Cache Aggressively
- Cache ETH prices for 60+ seconds
- Cache user data for 5+ minutes
- Cache match data for 1+ minute

### 4. Use Multiple RPC Providers
- Primary RPC for normal operations
- Fallback RPC for high load
- Distribute Web3 requests across providers

### 5. Implement Circuit Breakers
- Stop operations if error rate is too high
- Gracefully degrade functionality
- Alert administrators of issues

## Conclusion

The rate limiting system is designed to handle **50+ concurrent users** efficiently while preventing API overload. The multi-layer approach ensures:

- ✅ **Discord API protection** - Prevents Discord rate limits
- ✅ **Database efficiency** - Connection pooling and request limiting
- ✅ **Web3 reliability** - Conservative limits with retries
- ✅ **User fairness** - Per-user limits prevent abuse
- ✅ **Scalability** - Configurable for different user counts
- ✅ **Monitoring** - Real-time statistics and alerts

With proper configuration and monitoring, your Discord bot can handle significant concurrent load while maintaining optimal performance and user experience. 