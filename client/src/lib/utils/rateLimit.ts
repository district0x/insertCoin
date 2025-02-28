// Global request queue
const requestQueue: Array<() => Promise<unknown>> = [];
let isProcessing = false;
const RATE_LIMIT_DELAY = 200; // Reduced from 500ms to 200ms between requests
const BATCH_SIZE = 5; // Process up to 5 requests in parallel

// Process queue
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;

  while (requestQueue.length > 0) {
    // Process requests in batches
    const batch = requestQueue.splice(0, Math.min(BATCH_SIZE, requestQueue.length));
    
    try {
      // Execute batch in parallel
      await Promise.all(batch.map(request => request()));
    } catch (error) {
      console.error("Error processing request batch:", error);
    }
    
    // Only wait between batches, not individual requests
    if (requestQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  isProcessing = false;
}

export function throttleRequest<T>(request: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const wrappedRequest = async () => {
      try {
        const result = await request();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    requestQueue.push(wrappedRequest);
    processQueue();
  });
}
