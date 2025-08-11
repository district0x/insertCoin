"use client";

import * as React from "react";
import useSWR from "swr";
import { Trophy, Wallet } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

function truncate(addr?: string | null) {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function RecentWinners() {
    const { data } = useSWR('/api/stats/recent-winners', fetcher, {
        dedupingInterval: 60_000,
        revalidateOnFocus: false,
        keepPreviousData: true,
    });

    const winners = data?.data?.winners ?? [];

    return (
        <section className="container mx-auto px-4 mt-8">
            <h2 className="text-xl font-semibold mb-4">Recent Winners</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {winners.length === 0 && (
                    <p className="text-sm text-gray-400">No recent winners yet.</p>
                )}
                {winners.map((w: any) => (
                    <div key={w.matchId} className="bg-gradient-to-br from-gray-900/80 to-black/80 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-white font-medium">
                                    <Trophy className="h-4 w-4 text-red-400" />
                                    {w.game || 'Match'} #{w.matchId}
                                </div>
                                <div className="text-sm text-gray-300 mt-1">
                                    Winner: {w.winnerName || truncate(w.winnerAddress)}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-white font-semibold">{w.amount} {w.tokenName || 'ETH'}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
} 