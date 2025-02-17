"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMatch } from "@/lib/hooks/useMatch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { usePublicClient } from "wagmi";
import { updateMatchWithWallet, createMatchInDb } from "@/lib/services/match";
import { formatEther, decodeEventLog } from "viem";
import { MatchType } from "@prisma/client";
import { UsdInput } from "@/components/ui/usd-input";
import { ONEVONE_ABI } from "@/lib/contracts/abis/OneVOne";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type MatchEventArgs = {
  matchId: bigint;
  player1: `0x${string}`;
  matchAmount: bigint;
};

function CreateMatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { address } = useWalletConnection();
  const publicClient = usePublicClient();
  const [matchType, setMatchType] = React.useState<MatchType>(
    MatchType.ONE_V_ONE
  );
  const [ethAmount, setEthAmount] = React.useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = React.useState(false);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const { createMatch, create2v2Match, create5v5Match } = useMatch();

  // Get matchId from URL if it exists (coming from Discord)
  const matchId = searchParams.get("matchId");

  // Watch for transaction confirmation
  React.useEffect(() => {
    if (!txHash || !publicClient) return;

    const watchTransaction = async () => {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
        });

        if (receipt.status === "success") {
          setIsLoading(false); // Stop loading state

          // Find the match started event
          const eventName = (() => {
            switch (matchType) {
              case MatchType.FIVE_V_FIVE:
                return "Match5v5Started";
              case MatchType.TWO_V_TWO:
                return "Team2v2MatchStarted";
              default:
                return "MatchStarted";
            }
          })();

          const matchEvent = receipt.logs.find((log) => {
            try {
              const event = decodeEventLog({
                abi: ONEVONE_ABI,
                data: log.data,
                topics: log.topics,
              });
              return event.eventName === eventName;
            } catch {
              return false;
            }
          });

          if (!matchEvent) {
            throw new Error(`${eventName} event not found in transaction`);
          }

          const { args } = decodeEventLog({
            abi: ONEVONE_ABI,
            data: matchEvent.data,
            topics: matchEvent.topics,
          }) as { args: MatchEventArgs };

          const onChainMatchId = args.matchId.toString();

          // Now create the database entry with the correct match ID
          await createMatchInDb({
            walletAddress: address as string,
            matchType,
            stake: formatEther(ethAmount),
            matchId: Number(onChainMatchId),
          });

          toast({
            title: "Match Created Successfully!",
            description: `Your ${matchType.toLowerCase()} match has been created with ID #${onChainMatchId}.`,
          });

          // Redirect to the match page after a short delay
          setTimeout(() => {
            router.push(`/matches/${onChainMatchId}`);
          }, 1500);
        }
      } catch (error) {
        console.error("[Match Creation] Error watching transaction:", error);
        setIsLoading(false); // Stop loading state
        toast({
          variant: "destructive",
          title: "Transaction Failed",
          description:
            error instanceof Error ? error.message : "Please try again",
        });
      }
    };

    watchTransaction();
  }, [txHash, publicClient, matchType, ethAmount, address, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a match",
        variant: "destructive",
      });
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      // If matchId exists, this is a Discord-created match
      if (matchId) {
        const updatedMatch = await updateMatchWithWallet({
          matchId,
          walletAddress: address,
        });

        if (!updatedMatch) {
          throw new Error("Failed to update match");
        }

        const hash = await createMatch(BigInt(updatedMatch.stake));
        if (!hash) throw new Error("Failed to create match");

        setTxHash(hash);

        toast({
          title: "Transaction Submitted",
          description: "Your match is being created...",
        });
      } else {
        // Regular match creation flow
        try {
          let hash: `0x${string}` | undefined;
          switch (matchType) {
            case MatchType.TWO_V_TWO:
              hash = await create2v2Match(ethAmount);
              break;
            case MatchType.FIVE_V_FIVE:
              hash = await create5v5Match(ethAmount);
              break;
            default:
              hash = await createMatch(ethAmount);
          }

          if (!hash) throw new Error("Failed to create match");

          setTxHash(hash);
          toast({
            title: "Transaction Submitted",
            description: "Your match is being created...",
          });
        } catch (err) {
          throw err;
        }
      }
    } catch (err) {
      console.error("[Match Creation] Error:", err);

      // Extract contract error details
      const contractError = err as Error;
      const errorMessage = contractError.message;

      // Handle specific error cases
      if (errorMessage.includes("insufficient funds")) {
        toast({
          variant: "destructive",
          title: "Insufficient Funds",
          description:
            "You don't have enough ETH to cover the stake amount and gas fees. Please add more ETH to your wallet and try again.",
        });
      } else if (errorMessage.includes("User rejected")) {
        toast({
          variant: "destructive",
          title: "Transaction Cancelled",
          description: "You cancelled the transaction.",
        });
      } else {
        // Handle other contract errors
        toast({
          variant: "destructive",
          title: "Smart Contract Error",
          description:
            errorMessage || "Something went wrong. Please try again.",
        });
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/matches"
        className="flex items-center text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Matches
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            {matchId ? "Link Wallet to Discord Match" : "Create New Match"}
          </CardTitle>
          <CardDescription>
            {matchId
              ? "Connect your wallet to create the match from Discord"
              : "Choose your match type and stake amount"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {!matchId && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Match Type</label>
                  <Select
                    value={matchType}
                    onValueChange={(value: string) =>
                      setMatchType(value as MatchType)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select match type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MatchType.ONE_V_ONE}>
                        1v1 Match
                      </SelectItem>
                      <SelectItem value={MatchType.TWO_V_TWO}>
                        2v2 Match
                      </SelectItem>
                      <SelectItem value={MatchType.FIVE_V_FIVE}>
                        5v5 Match
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <UsdInput
                    label="Stake Amount (USD)"
                    onEthChange={setEthAmount}
                    placeholder="Enter stake amount in USD"
                    disabled={isLoading}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    {ethAmount > BigInt(0) && `≈ ${formatEther(ethAmount)} ETH`}
                  </p>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || (!matchId && ethAmount === BigInt(0))}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating match...
                </span>
              ) : matchId ? (
                "Link Wallet and Create Match"
              ) : (
                "Create Match"
              )}
            </Button>
          </form>

          {txHash && (
            <div className="mt-4 text-sm text-muted-foreground">
              Transaction Hash:{" "}
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {txHash}
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreateMatchPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <CreateMatchForm />
    </React.Suspense>
  );
}
