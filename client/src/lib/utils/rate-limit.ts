interface RateLimitEntry {
    count: number;
    resetTime: number;
    firstRequest: number;
    lastRequest: number;
    blocked: boolean;
    blockReason?: string;
}

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    blockDurationMs: number;
    enableLogging: boolean;
    enableMetrics: boolean;
}

class RateLimiter {
    private requests: Map<string, RateLimitEntry> = new Map();
    private readonly config: RateLimitConfig;
    private metrics: {
        totalRequests: number;
        blockedRequests: number;
        uniqueIPs: number;
        lastReset: number;
    };

    constructor(config: Partial<RateLimitConfig> = {}) {
        this.config = {
            windowMs: 60000, // 1 minute
            maxRequests: 100,
            blockDurationMs: 300000, // 5 minutes
            enableLogging: true,
            enableMetrics: true,
            ...config
        };

        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            uniqueIPs: 0,
            lastReset: Date.now()
        };

        // Clean up old entries every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);

        // Reset metrics every hour
        setInterval(() => {
            this.resetMetrics();
        }, 60 * 60 * 1000);
    }

    isAllowed(identifier: string): boolean {
        const now = Date.now();
        const entry = this.requests.get(identifier);

        // Update metrics
        if (this.config.enableMetrics) {
            this.metrics.totalRequests++;
        }

        if (!entry) {
            // First request from this identifier
            this.requests.set(identifier, {
                count: 1,
                resetTime: now + this.config.windowMs,
                firstRequest: now,
                lastRequest: now,
                blocked: false
            });

            if (this.config.enableMetrics) {
                this.metrics.uniqueIPs++;
            }

            if (this.config.enableLogging) {
                console.log(`[RATE-LIMIT] First request from ${identifier}`);
            }

            return true;
        }

        // Check if IP is blocked
        if (entry.blocked) {
            if (now < entry.resetTime) {
                if (this.config.enableMetrics) {
                    this.metrics.blockedRequests++;
                }
                if (this.config.enableLogging) {
                    console.log(`[RATE-LIMIT] Blocked request from ${identifier}: ${entry.blockReason}`);
                }
                return false;
            } else {
                // Block period expired, unblock
                entry.blocked = false;
                entry.blockReason = undefined;
                entry.count = 0;
                entry.resetTime = now + this.config.windowMs;
            }
        }

        if (now > entry.resetTime) {
            // Window has expired, reset
            entry.count = 1;
            entry.resetTime = now + this.config.windowMs;
            entry.firstRequest = now;
            entry.lastRequest = now;
            entry.blocked = false;
            entry.blockReason = undefined;

            if (this.config.enableLogging) {
                console.log(`[RATE-LIMIT] Window reset for ${identifier}`);
            }

            return true;
        }

        if (entry.count >= this.config.maxRequests) {
            // Limit exceeded, block the IP
            entry.blocked = true;
            entry.blockReason = 'Rate limit exceeded';
            entry.resetTime = now + this.config.blockDurationMs;

            if (this.config.enableMetrics) {
                this.metrics.blockedRequests++;
            }

            if (this.config.enableLogging) {
                console.log(`[RATE-LIMIT] Blocked ${identifier} for ${this.config.blockDurationMs}ms`);
            }

            return false;
        }

        // Increment count and update last request time
        entry.count++;
        entry.lastRequest = now;

        if (this.config.enableLogging && entry.count % 10 === 0) {
            console.log(`[RATE-LIMIT] ${identifier}: ${entry.count}/${this.config.maxRequests} requests`);
        }

        return true;
    }

    getRemainingTime(identifier: string): number {
        const entry = this.requests.get(identifier);
        if (!entry) return 0;

        const remaining = entry.resetTime - Date.now();
        return Math.max(0, remaining);
    }

    getRemainingRequests(identifier: string): number {
        const entry = this.requests.get(identifier);
        if (!entry) return this.config.maxRequests;

        if (entry.blocked) return 0;
        if (Date.now() > entry.resetTime) return this.config.maxRequests;

        return Math.max(0, this.config.maxRequests - entry.count);
    }

    isBlocked(identifier: string): boolean {
        const entry = this.requests.get(identifier);
        if (!entry) return false;

        return entry.blocked && Date.now() < entry.resetTime;
    }

    getBlockReason(identifier: string): string | undefined {
        const entry = this.requests.get(identifier);
        if (!entry) return undefined;

        return entry.blockReason;
    }

    // Clean up old entries to prevent memory leaks
    cleanup(): void {
        const now = Date.now();
        const beforeSize = this.requests.size;

        for (const [key, entry] of this.requests.entries()) {
            // Remove entries that are older than 2x the block duration
            if (now > entry.resetTime + this.config.blockDurationMs) {
                this.requests.delete(key);
            }
        }

        const afterSize = this.requests.size;
        if (this.config.enableLogging && beforeSize !== afterSize) {
            console.log(`[RATE-LIMIT] Cleaned up ${beforeSize - afterSize} old entries`);
        }
    }

    // Get current metrics
    getMetrics() {
        return {
            ...this.metrics,
            currentEntries: this.requests.size,
            config: this.config
        };
    }

    // Reset metrics
    private resetMetrics(): void {
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            uniqueIPs: 0,
            lastReset: Date.now()
        };

        if (this.config.enableLogging) {
            console.log('[RATE-LIMIT] Metrics reset');
        }
    }

    // Update configuration
    updateConfig(newConfig: Partial<RateLimitConfig>): void {
        Object.assign(this.config, newConfig);

        if (this.config.enableLogging) {
            console.log('[RATE-LIMIT] Configuration updated:', this.config);
        }
    }

    // Get current configuration
    getConfig(): RateLimitConfig {
        return { ...this.config };
    }

    // Manually block an IP
    blockIP(identifier: string, reason: string, durationMs?: number): void {
        const blockDuration = durationMs || this.config.blockDurationMs;
        const now = Date.now();

        this.requests.set(identifier, {
            count: 0,
            resetTime: now + blockDuration,
            firstRequest: now,
            lastRequest: now,
            blocked: true,
            blockReason: reason
        });

        if (this.config.enableLogging) {
            console.log(`[RATE-LIMIT] Manually blocked ${identifier} for ${blockDuration}ms: ${reason}`);
        }
    }

    // Manually unblock an IP
    unblockIP(identifier: string): boolean {
        const entry = this.requests.get(identifier);
        if (!entry || !entry.blocked) return false;

        entry.blocked = false;
        entry.blockReason = undefined;
        entry.count = 0;
        entry.resetTime = Date.now() + this.config.windowMs;

        if (this.config.enableLogging) {
            console.log(`[RATE-LIMIT] Manually unblocked ${identifier}`);
        }

        return true;
    }

    // Get all blocked IPs
    getBlockedIPs(): Array<{ identifier: string; reason: string; remainingTime: number }> {
        const now = Date.now();
        const blocked: Array<{ identifier: string; reason: string; remainingTime: number }> = [];

        for (const [identifier, entry] of this.requests.entries()) {
            if (entry.blocked && now < entry.resetTime) {
                blocked.push({
                    identifier,
                    reason: entry.blockReason || 'Unknown',
                    remainingTime: entry.resetTime - now
                });
            }
        }

        return blocked;
    }
}

// Create a global rate limiter instance with enhanced configuration
export const rateLimiter = new RateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    blockDurationMs: 300000, // 5 minutes block duration
    enableLogging: process.env.NODE_ENV === 'development',
    enableMetrics: true
});

export default rateLimiter; 