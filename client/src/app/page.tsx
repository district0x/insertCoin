"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { formatEther, createPublicClient, http } from "viem";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import { fetchMatches } from "@/lib/match";
import { OnChainMatch } from "@/types/match";
import { baseSepolia } from "@/lib/config/chains";
import { Button } from "@/components/ui/button";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";

// Components
import HeroSlider from "@/components/home/hero-slider";
import StatsSection from "@/components/home/stats-section";
import ExtendedStats from "@/components/home/extended-stats";
import TrendingGames from "@/components/home/trending-games";
import RecentWinners from "@/components/home/recent-winners";
import HowItWorks from "@/components/home/how-it-works";
import QuickActions from "@/components/home/quick-actions";
import TournamentsAndStreaming from "@/components/home/tournaments-and-streaming";
import ScrollToTop from "@/components/ui/scroll-to-top";

export default function Home() {
  const { isConnected } = useWalletConnection();

  return (
    <div>
      <HeroSlider />

      {/* Wallet Connection Prompt */}
      {!isConnected && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mx-4 my-8 text-center max-w-4xl mx-auto">
          <p className="text-red-400 text-sm">
            Connect your wallet to create matches and join tournaments
          </p>
        </div>
      )}

      <StatsSection />
      <ExtendedStats />
      <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendingGames />
        <RecentWinners />
      </div>
      <QuickActions />
      <HowItWorks />
      <TournamentsAndStreaming />
      <ScrollToTop />
    </div>
  );
}
