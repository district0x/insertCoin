import { useStats } from "@/contexts/StatsContext";

export function useRefreshStats() {
    const { refreshStats } = useStats();
    return refreshStats;
} 