import { useCallback, useEffect } from "react";

interface UsePollingProps {
  callback: () => void | Promise<void>;
  interval: number;
  enabled?: boolean;
}

/**
 * A hook for polling a callback function at a specified interval,
 * respecting visibility state (only runs when tab is visible)
 */
export function usePolling({ callback, interval, enabled = true }: UsePollingProps) {
  const handler = useCallback(async () => {
    try {
      await callback();
    } catch (error) {
      console.error("Error in polling callback:", error);
    }
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Function to start polling
    const startPolling = () => {
      // Clear any existing timeout to prevent duplicate timers
      if (timeoutId) clearTimeout(timeoutId);
      
      // Schedule the next execution
      timeoutId = setTimeout(() => {
        handler().finally(() => {
          // Only set up the next poll if the component is still mounted
          if (document.visibilityState === 'visible') {
            startPolling();
          }
        });
      }, interval);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Start polling when tab is visible
        startPolling();
      } else {
        // Clear timeout when tab is hidden
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    
    // Call handler immediately
    handler().finally(() => {
      // Only start polling if still visible after initial call
      if (document.visibilityState === 'visible') {
        startPolling();
      }
    });
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handler, interval, enabled]);
} 