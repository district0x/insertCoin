import { useState, useEffect } from 'react';

interface CacheItem<T> {
    data: T;
    timestamp: number;
}

/**
 * A custom hook for caching blockchain data to avoid hitting rate limits
 * Specifically designed to handle ThirdWeb RPC rate limits
 */
export function useCachedBlockchainData<T>(
    key: string,
    fetchFn: () => Promise<T>,
    cacheDuration = 60000, // 1 minute by default
    dependencies: any[] = []
) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [lastFetched, setLastFetched] = useState(0);

    // Function to fetch data with caching
    const fetchData = async (force = false) => {
        setIsLoading(true);
        setError(null);

        try {
            // Check browser storage for cached data first
            const cachedItem = localStorage.getItem(`blockchain_${key}`);
            const now = Date.now();

            if (!force && cachedItem) {
                try {
                    const parsedCache: CacheItem<T> = JSON.parse(cachedItem);
                    // If cache is still valid
                    if (now - parsedCache.timestamp < cacheDuration) {
                        console.log(`Using cached blockchain data for ${key}`);
                        setData(parsedCache.data);
                        setLastFetched(parsedCache.timestamp);
                        setIsLoading(false);
                        return parsedCache.data;
                    }
                } catch (e) {
                    // If parse fails, ignore the cache
                    console.warn(`Cache parse error for ${key}:`, e);
                }
            }

            // If we get here, we need fresh data
            // Add a small random delay to prevent multiple simultaneous requests
            const delay = Math.random() * 500; // 0-500ms random delay
            await new Promise(resolve => setTimeout(resolve, delay));

            // Fetch fresh data
            console.log(`Fetching fresh blockchain data for ${key}`);
            const freshData = await fetchFn();

            // Cache the result
            const cacheEntry: CacheItem<T> = {
                data: freshData,
                timestamp: now
            };

            // Store in localStorage
            localStorage.setItem(`blockchain_${key}`, JSON.stringify(cacheEntry));

            setData(freshData);
            setLastFetched(now);
            return freshData;
        } catch (err) {
            console.error(`Error fetching blockchain data for ${key}:`, err);
            setError(err instanceof Error ? err : new Error(String(err)));

            // Even if there's an error, try to use cached data as fallback
            const cachedItem = localStorage.getItem(`blockchain_${key}`);
            if (cachedItem) {
                try {
                    const parsedCache: CacheItem<T> = JSON.parse(cachedItem);
                    console.log(`Using cached blockchain data as fallback for ${key} after error`);
                    setData(parsedCache.data);
                    setLastFetched(parsedCache.timestamp);
                    return parsedCache.data;
                } catch (e) {
                    // If parse fails, we have no fallback
                    console.warn(`Cache parse error for fallback ${key}:`, e);
                }
            }

            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, [...dependencies]);

    return {
        data,
        isLoading,
        error,
        lastFetched,
        refresh: () => fetchData(true), // Force refresh function
        clearCache: () => {
            localStorage.removeItem(`blockchain_${key}`);
            setLastFetched(0);
        }
    };
}
