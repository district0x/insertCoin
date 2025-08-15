"use client";

import * as React from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Play } from "lucide-react";

export default function TournamentsAndStreaming() {
    // For now, we'll show as if always live
    // In the future, you can integrate with Twitch API to check actual status
    const isLive = true;

    return (
        <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Live Gaming & Streaming
                    </h2>
                    <p className="text-gray-300 max-w-2xl mx-auto">
                        Watch live matches and join the Insert Coin community
                    </p>
                </div>

                {/* Live Stream Section */}
                <div className="max-w-4xl mx-auto mb-12">
                    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 overflow-hidden hover:border-red-500/40 transition-all duration-300 hover:scale-[1.02]">
                        <CardHeader className="relative pb-4">
                            <div className="flex justify-end">
                                {/* Live indicator */}
                                {isLive && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                        <span className="px-3 py-1 text-sm bg-red-500 text-white rounded-full font-medium">
                                            LIVE NOW
                                        </span>
                                    </div>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Stream Info */}
                            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Play className="h-10 w-10 text-red-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">
                                    {isLive ? "Live Now" : "Offline"}
                                </h3>
                                <p className="text-gray-300 text-sm mb-4">
                                    {isLive
                                        ? "Watch live matches, tournaments, and gaming content from the Insert Coin community"
                                        : "Check back later for live content"
                                    }
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* StreamTide Section */}
                <div className="mt-12 flex flex-col items-center">
                    <Image
                        src="/streamtide.png"
                        alt="StreamTide Logo"
                        width={104}
                        height={96}
                        className="mb-4"
                    />
                    <Button
                        size="lg"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() =>
                            window.open(
                                "https://streamtide.io/profile/0x944C8e0C05aa90C3C03C16b0703fF66e2ecaa2fa",
                                "_blank"
                            )
                        }
                    >
                        Support us on StreamTide
                    </Button>
                </div>
            </div>
        </section>
    );
} 