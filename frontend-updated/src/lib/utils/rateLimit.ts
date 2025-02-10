// Global request queue
const requestQueue: Array<() => Promise<unknown>> = [];
let isProcessing = false;
const RATE_LIMIT_DELAY = 500; // 500ms between requests

// Process queue
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error) {
        console.error("Error processing request:", error);
      }
      // Wait before processing next request
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
