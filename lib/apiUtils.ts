// lib/apiUtils.ts - Create this new file

/**
 * Executes a function with exponential backoff retry logic
 * @param fn The async function to execute
 * @param retries Maximum number of retries
 * @param baseDelay Base delay in ms (will be multiplied by 2^retry)
 * @param maxDelay Maximum delay between retries in ms
 */
export async function withExponentialBackoff<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 10000
): Promise<T> {
    let lastError: any;

    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // If this is a rate limit error (429)
            const isRateLimit = error.status === 429 ||
                (error.message && error.message.includes('429')) ||
                (error.message && error.message.includes('Too Many Requests'));

            if (i === retries || !isRateLimit) {
                // If we're out of retries or it's not a rate limit error, throw
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);

            // Add some jitter to prevent all clients retrying simultaneously
            const jitter = Math.random() * 200;

            console.log(`API rate limited. Retrying in ${(delay + jitter) / 1000}s (attempt ${i + 1}/${retries})`);

            // Wait before next retry
            await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
    }

    throw lastError;
}