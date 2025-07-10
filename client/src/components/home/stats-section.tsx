"use client";

import * as React from "react";
import { useStats } from "@/contexts/StatsContext";
import { Coins, Users } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    isLoading?: boolean;
}

function StatCard({ title, value, subtitle, icon, isLoading }: StatCardProps) {
    return (
        <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-full">
                    {icon}
                </div>
                {isLoading && (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                )}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
                {isLoading ? "..." : value}
            </h3>
            {subtitle && (
                <p className="text-gray-300 text-sm mb-1">{subtitle}</p>
            )}
            <p className="text-gray-300 text-sm">{title}</p>
        </div>
    );
}

export default function StatsSection() {
    const { stats, isLoading, error } = useStats();

    return (
        <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Platform Statistics
                    </h2>
                    <p className="text-gray-300 max-w-2xl mx-auto">
                        Track the growth and activity of the Insert Coin gaming platform
                    </p>
                </div>

                {error && (
                    <div className="text-center mb-8">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <StatCard
                        title="Matches Created"
                        value={stats.matchesCreated}
                        icon={<Users className="h-6 w-6 text-red-400" />}
                        isLoading={isLoading}
                    />

                    <StatCard
                        title="Matching Pool"
                        value={`$${stats.matchingPoolUSD}`}
                        subtitle={`${stats.matchingPool} ETH`}
                        icon={<Coins className="h-6 w-6 text-red-400" />}
                        isLoading={isLoading}
                    />
                </div>

                <div className="text-center mt-8">
                    <p className="text-gray-400 text-sm">
                        * Statistics update every 5 minutes
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                        Last updated: {new Date().toLocaleTimeString()}
                    </p>
                </div>
            </div>
        </section>
    );
} 