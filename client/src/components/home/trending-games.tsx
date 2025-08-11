"use client";

import * as React from "react";
import useSWR from "swr";
import { Gamepad2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function TrendingGames() {
    const { data } = useSWR('/api/stats/games', fetcher, {
        dedupingInterval: 60_000,
        revalidateOnFocus: false,
        keepPreviousData: true,
    });

    const games: { game: string; count: number }[] = data?.data?.topGames ?? [];
    const max = Math.max(1, ...games.map(g => g.count));

    return (
        <section className="container mx-auto px-4 mt-8">
            <h2 className="text-xl font-semibold mb-4">Top Games (7d)</h2>
            <div className="space-y-3">
                {games.length === 0 && (
                    <p className="text-sm text-gray-400">No data available.</p>
                )}
                {games.map(g => (
                    <div key={g.game} className="bg-gradient-to-br from-gray-900/80 to-black/80 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Gamepad2 className="h-4 w-4 text-red-400" />
                                <span className="font-medium text-white">{g.game}</span>
                            </div>
                            <span className="text-sm text-gray-300">{g.count}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded">
                            <div className="h-2 bg-red-500 rounded" style={{ width: `${(g.count / max) * 100}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
} 