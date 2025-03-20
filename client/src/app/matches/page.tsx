"use client";

import * as React from "react";
import Link from "next/link";
import { useContract } from "@/lib/hooks/useContract";
import { usePublicClient } from "wagmi";
import MatchList from "@/components/match/match-list";
import { fetchMatch } from "@/lib/match/fetch";

export default function MatchesPage() {
  const contract = useContract();
  const publicClient = usePublicClient();
  const [error, setError] = React.useState<string | null>(null);
  
  // Debug contract address
  React.useEffect(() => {
    // Try to directly call nextMatchId
    if (contract && publicClient) {
      publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "nextMatchId",
      }).catch(error => {
        console.error("nextMatchId direct call failed:", error);
        setError("Failed to connect to the blockchain. Please check your network connection and try again.");
      });
    }
  }, [contract, publicClient]);

  // Expose debug function in development environment
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Suppressing type error for development environment check
      window.debugFetchMatch = async (matchId) => {
        try {
          if (!contract || !publicClient) {
            console.error('Contract or publicClient not available');
            return null;
          }
          return await fetchMatch(contract, publicClient, matchId.toString());
        } catch (error) {
          console.error(`Error in debugFetchMatch for match ${matchId}:`, error);
          return null;
        }
      };
    }
  }, [contract, publicClient]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Matches</h1>
          <Link
            href="/matches/create"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Create Match
          </Link>
        </div>

        {/* Fixed height container to prevent layout shifts */}
        <div className="min-h-[800px]">
          {error ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-destructive font-medium">Connection Error</p>
              <p className="text-muted-foreground">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                Refresh Page
              </button>
            </div>
          ) : (
            <MatchList contract={contract} publicClient={publicClient} />
          )}
        </div>
      </div>
    </div>
  );
}
