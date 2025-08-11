"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";

export default function QuickActions() {
    const { isConnected } = useWalletConnection();

    return (
        <section className="py-12 bg-gradient-to-br from-black via-gray-900 to-black">
            <div className="container mx-auto px-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-6">
                        Quick Actions
                    </h2>
                    <div className="flex justify-center gap-4 flex-wrap">
                        <a href="https://discord.gg/8RYncgpCYc" target="_blank" rel="noopener noreferrer">
                            <Button className="bg-red-600 hover:bg-red-700 px-8 py-3 text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg">
                                Create Match
                            </Button>
                        </a>
                        <Link href="/matches">
                            <Button variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 px-8 py-3 text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg">
                                Browse Matches
                            </Button>
                        </Link>
                        {isConnected && (
                            <Link href="/tournaments/create">
                                <Button variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 px-8 py-3 text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg">
                                    Create Tournament
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
} 