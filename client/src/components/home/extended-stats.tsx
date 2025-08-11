"use client";

import * as React from "react";
import useSWR from "swr";
import { Trophy, Coins, BarChart3, Users, Activity, Zap } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ExtendedStats() {
    const { data, error, isLoading } = useSWR('/api/stats/overview', fetcher, {
        dedupingInterval: 60_000,
        revalidateOnFocus: false,
        keepPreviousData: true,
    });

    const stats = data?.data;

    const items = [
        {
            label: 'Matches Open',
            value: stats?.matchesOpen ?? 0,
            icon: Activity,
        },
        {
            label: 'Matches Completed',
            value: stats?.matchesCompleted ?? 0,
            icon: Trophy,
        },
        {
            label: 'Total Prize Paid (ETH)',
            value: (stats?.totalPrizePaidEth ?? 0).toFixed(4),
            icon: Zap,
        },
        {
            label: 'Total Prize Paid (MATCH)',
            value: Math.floor(stats?.totalPrizePaidMatch ?? 0),
            icon: Coins,
        },
        {
            label: 'Avg Entry Fee (ETH)',
            value: (stats?.avgEntryFeeEth ?? 0).toFixed(4),
            icon: BarChart3,
        },
        {
            label: 'Avg Entry Fee (MATCH)',
            value: Math.floor(stats?.avgEntryFeeMatch ?? 0),
            icon: BarChart3,
        },
        {
            label: 'New Matches (24h)',
            value: stats?.newMatches24h ?? 0,
            icon: Zap,
        },
        {
            label: 'Active Players (7d)',
            value: stats?.activePlayers7d ?? 0,
            icon: Users,
        },
    ];

    return (
        <section className="container mx-auto px-4 mt-8">
            <h2 className="text-xl font-semibold mb-4">Platform Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map((it, idx) => {
                    const Icon = it.icon;
                    return (
                        <div key={idx} className="bg-gradient-to-br from-gray-900/80 to-black/80 border border-red-500/20 rounded-xl p-4 hover:border-red-500/40 transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">{it.label}</p>
                                    <p className="text-lg font-bold text-white mt-1">{isLoading ? '—' : it.value}</p>
                                </div>
                                <Icon className="h-5 w-5 text-red-400" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
} 