import { OnChainMatch } from "@/types/match";

// Cache for match data
const matchCache = new Map<string, OnChainMatch>();

// Cache durations based on match state
export const CACHE_DURATIONS = {
  COMPLETED: 30 * 60 * 1000, // 30 minutes for completed matches
  IN_PROGRESS: 60 * 1000,    // 1 minute for in-progress matches
  OPEN: 2 * 60 * 1000,       // 2 minutes for open matches
  DEFAULT: 60 * 1000         // 1 minute default
};

export function getCacheExpiry(match: OnChainMatch): number {
  if (!match.isOpen) return CACHE_DURATIONS.COMPLETED;
  if (match.player2 !== "0x0000000000000000000000000000000000000000") return CACHE_DURATIONS.IN_PROGRESS;
  return CACHE_DURATIONS.OPEN;
}

export function getCachedMatch(matchId: string): OnChainMatch | null {
  return matchCache.get(matchId) || null;
}

export function cacheMatch(matchId: string, match: OnChainMatch) {
  matchCache.set(matchId, match);
}

// Add function to clear cache
export function clearMatchCache(matchId?: string) {
  if (matchId) {
    matchCache.delete(matchId);
    console.log(`[CACHE] Cleared cache for match ${matchId}`);
  } else {
    matchCache.clear();
    console.log(`[CACHE] Cleared all match cache`);
  }
}

// Prefetch cache for quick access
export const prefetchCache = new Map<string, Promise<OnChainMatch | null>>(); 