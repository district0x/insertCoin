// lib/rateLimiter.ts
// A simple client-side rate limiter with caching for API requests

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
 * Client-side rate limiter with caching functionality
 */
class RateLimiter {
    private cache: Map<string, CacheEntry>;
    private requests: Map<string, { count: number, resetTime: number }>;
    private maxRequests: number;
    private windowMs: number;
    private cacheTtl: number;

    constructor(maxRequests = 10, windowMs = 60000, cacheTtl = 30000) {
        this.cache = new Map();
        this.requests = new Map();
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.cacheTtl = cacheTtl;

        // Clean up expired rate limit entries periodically
        setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.requests.entries()) {
                if (now > data.resetTime) {
                    this.requests.delete(key);
                }
            }
        }, windowMs);

        // Clean up old cache entries periodically
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > this.cacheTtl) {
                    this.cache.delete(key);
                }
            }
        }, cacheTtl);
    }

    /**
     * Makes a fetch request with rate limiting and caching
     * @param url The URL to fetch
     * @param options Fetch options
     * @param forceRefresh Whether to ignore cache and force a new request
     */
    async fetch(url: string, options: RequestInit = {}, forceRefresh = false): Promise<RateLimiterResult> {
        // Create a cache key from the URL and any body in the options
        const cacheKey = this.createCacheKey(url, options);

        // Check cache first if we're not forcing a refresh
        if (!forceRefresh) {
            const cachedData = this.cache.get(cacheKey);
            if (cachedData && (Date.now() - cachedData.timestamp < this.cacheTtl)) {
                console.log(`[RateLimiter] Using cached data for ${url}`);
                return { data: cachedData.data, cached: true };
            }
        }

        // Check rate limit
        if (!this.checkRateLimit(url)) {
            console.warn(`[RateLimiter] Rate limit reached for ${url}`);

            // If we have cached data, return it even if expired
            const cachedData = this.cache.get(cacheKey);
            if (cachedData) {
                return {
                    data: cachedData.data,
                    cached: true,
                    error: 'Rate limit reached, returning cached data'
                };
            }

            return { error: 'Rate limit reached' };
        }

        try {
            // Add cache control headers to prevent browser caching
            const fetchOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            };

            // Make the request
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                // Handle rate limiting responses
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    return {
                        error: `Rate limited by server. Retry after ${retryAfter || 'some time'}`,
                        cached: false
                    };
                }

                throw new Error(`HTTP error: ${response.status}`);
            }

            // Parse the response
            const data = await response.json();

            // Cache the successful response
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now(),
                cached: false
            });

            return { data, cached: false };
        } catch (error) {
            console.error(`[RateLimiter] Fetch error:`, error);

            // Return cached data if available, even if expired
            const cachedData = this.cache.get(cacheKey);
            if (cachedData) {
                return {
                    data: cachedData.data,
                    cached: true,
                    error: `Error fetching new data: ${error instanceof Error ? error.message : String(error)}`
                };
            }

            return { error: `Fetch error: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    /**
     * Creates a cache key from a URL and options
     */
    private createCacheKey(url: string, options: RequestInit): string {
        // Include body in cache key if present
        let bodyKey = '';
        if (options.body) {
            bodyKey = typeof options.body === 'string'
                ? options.body
                : JSON.stringify(options.body);
        }
        return `${url}|${bodyKey}`;
    }

    /**
     * Checks if a request is allowed by the rate limiter
     */
    private checkRateLimit(url: string): boolean {
        const now = Date.now();
        const baseUrl = new URL(url).origin;

        // Get or initialize rate limit data for this URL
        const rateData = this.requests.get(baseUrl) || {
            count: 0,
            resetTime: now + this.windowMs
        };

        // Reset if window has passed
        if (now > rateData.resetTime) {
            rateData.count = 0;
            rateData.resetTime = now + this.windowMs;
        }

        // Check if allowed
        if (rateData.count >= this.maxRequests) {
            return false;
        }

        // Increment count and save
        rateData.count++;
        this.requests.set(baseUrl, rateData);

        return true;
    }

    /**
     * Clears all cached data
     */
    clearCache(): void {
        this.cache.clear();
        console.log('[RateLimiter] Cache cleared');
    }
}

// Export a singleton instance
export const rateLimiter = new RateLimiter();