// lib/clientRateLimiter.ts
// Create a new separate client-side rate limiter file

interface CacheEntry {
    data: any;
    timestamp: number;
    cached: boolean;
}

interface RateLimiterResult {
    data?: any;
    error?: string;
    cached?: boolean;
}

/**
 * Simple client-side rate limiter with caching
 */
class ClientRateLimiter {
    private cache: Map<string, CacheEntry> = new Map();
    private requestTimes: number[] = [];
    private maxRequests: number = 10; // Max 10 requests
    private timeWindow: number = 10000; // In a 10-second window
    private cacheTTL: number = 60000; // Cache TTL: 1 minute

    /**
     * Rate-limited fetch with caching
     */
    async fetch(url: string, options: RequestInit = {}, forceRefresh: boolean = false): Promise<RateLimiterResult> {
        // Create a cache key from the URL and options
        const cacheKey = `${url}-${JSON.stringify(options)}`;

        // Check cache if not forcing a refresh
        if (!forceRefresh) {
            const cachedItem = this.cache.get(cacheKey);
            if (cachedItem && Date.now() - cachedItem.timestamp < this.cacheTTL) {
                console.log(`Using cached data for ${url}`);
                return {
                    data: cachedItem.data,
                    cached: true
                };
            }
        }

        // Apply rate limiting
        const now = Date.now();

        // Remove request timestamps outside the time window
        this.requestTimes = this.requestTimes.filter(time => now - time < this.timeWindow);

        // Check if we've hit the rate limit
        if (this.requestTimes.length >= this.maxRequests) {
            console.warn(`Rate limit reached for ${url}`);
            return {
                error: 'Rate limit exceeded. Please try again later.'
            };
        }

        // Add this request to the timestamps
        this.requestTimes.push(now);

        // Make the fetch request
        try {
            const response = await window.fetch(url, options);

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the result
            this.cache.set(cacheKey, {
                data,
                timestamp: now,
                cached: false
            });

            return { data, cached: false };
        } catch (error: any) {
            console.error(`Fetch error:`, error);
            return {
                error: error.message || 'Failed to fetch data'
            };
        }
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export a singleton instance
export const clientRateLimiter = new ClientRateLimiter();