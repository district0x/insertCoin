"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
const HeroSlider = dynamic(() => import("@/components/home/hero-slider"), { ssr: false, loading: () => <div className="h-40 sm:h-56 bg-muted/20 animate-pulse" /> });
const StatsSection = dynamic(() => import("@/components/home/stats-section"), { ssr: false, loading: () => <div className="container mx-auto px-4 py-12"><div className="h-32 bg-muted/20 rounded-lg animate-pulse" /></div> });
const TrendingGames = dynamic(() => import("@/components/home/trending-games"), { ssr: true, loading: () => <div className="h-40 bg-muted/20 rounded-lg animate-pulse" /> });
const RecentWinners = dynamic(() => import("@/components/home/recent-winners"), { ssr: true, loading: () => <div className="h-40 bg-muted/20 rounded-lg animate-pulse" /> });
const HowItWorks = dynamic(() => import("@/components/home/how-it-works"), { ssr: true, loading: () => <div className="h-40 bg-muted/20 rounded-lg animate-pulse" /> });
const QuickActions = dynamic(() => import("@/components/home/quick-actions"), { ssr: true, loading: () => <div className="h-20 bg-muted/20 rounded-lg animate-pulse" /> });
const TournamentsAndStreaming = dynamic(() => import("@/components/home/tournaments-and-streaming"), { ssr: true, loading: () => <div className="h-40 bg-muted/20 rounded-lg animate-pulse" /> });
const ScrollToTop = dynamic(() => import("@/components/ui/scroll-to-top"), { ssr: false });

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
      {/* Platform Overview removed per request */}
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
