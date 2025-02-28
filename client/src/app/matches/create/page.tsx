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
import { MatchType } from "@/types/match";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MTK_TOKEN, TokenOption, TOKEN_OPTIONS } from "@/lib/constants/tokens";

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
  const [matchType, setMatchType] = React.useState<MatchType>("ONE_V_ONE");
  const [ethAmount, setEthAmount] = React.useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = React.useState(false);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [selectedToken, setSelectedToken] = React.useState<TokenOption>("ETH");
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
              case "FIVE_V_FIVE":
                return "Match5v5Started";
              case "TWO_V_TWO":
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
            tokenAddress: selectedToken === "MTK" ? MTK_TOKEN.address : null,
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
        setIsLoading(false);
        console.error("Transaction error:", error);
        toast({
          title: "Transaction Failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to create match. Please try again.",
          variant: "destructive",
        });
      }
    };

    watchTransaction();
  }, [txHash, publicClient, matchType, address, ethAmount, router, toast, selectedToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

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

        // For Discord-created matches, we currently only support ETH
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
          // Get token address if MTK is selected
          const tokenAddress = selectedToken === "MTK" ? MTK_TOKEN.address : undefined;
          
          switch (matchType) {
            case "TWO_V_TWO":
              hash = await create2v2Match(ethAmount, tokenAddress);
              break;
            case "FIVE_V_FIVE":
              hash = await create5v5Match(ethAmount, tokenAddress);
              break;
            default:
              hash = await createMatch(ethAmount, tokenAddress);
          }

          if (!hash) throw new Error("Failed to create match");

          // Now hash is guaranteed to be a `0x${string}` and not undefined
          setTxHash(hash);
          toast({
            title: "Transaction Submitted",
            description: "Your match is being created...",
          });
        } catch (err) {
          throw err;
        }
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error creating match:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create match. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex justify-center items-start min-h-[calc(100vh-80px)] py-12 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            href="/matches"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Matches
          </Link>
        </div>

        <Card className="shadow-md border-opacity-50">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">
              {matchId ? "Link Wallet to Discord Match" : "Create New Match"}
            </CardTitle>
            <CardDescription className="text-base">
              {matchId
                ? "Connect your wallet to create the match from Discord"
                : "Choose your match type and stake amount"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {!matchId && (
                <>
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Match Type</label>
                    <Select
                      value={matchType}
                      onValueChange={(value: string) =>
                        setMatchType(value as MatchType)
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select match type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONE_V_ONE">
                          1v1 Match
                        </SelectItem>
                        <SelectItem value="TWO_V_TWO">
                          2v2 Match
                        </SelectItem>
                        <SelectItem value="FIVE_V_FIVE">
                          5v5 Match
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Token</Label>
                    <RadioGroup 
                      value={selectedToken} 
                      onValueChange={(value) => setSelectedToken(value as TokenOption)}
                      className="flex space-x-6 pt-2"
                      disabled={isLoading}
                    >
                      {TOKEN_OPTIONS.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={option.value.toLowerCase()} />
                          <Label htmlFor={option.value.toLowerCase()} className="cursor-pointer font-medium">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <UsdInput
                      label="Stake Amount (USD)"
                      onEthChange={setEthAmount}
                      placeholder="Enter stake amount in USD"
                      disabled={isLoading}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {ethAmount > BigInt(0) && (
                        selectedToken === "ETH" 
                          ? `≈ ${formatEther(ethAmount)} ETH` 
                          : `≈ ${formatEther(ethAmount)} MTK`
                      )}
                    </p>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full py-6 text-base font-medium"
                disabled={isLoading || (!matchId && ethAmount === BigInt(0))}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
              <div className="mt-6 text-sm text-muted-foreground p-3 bg-muted rounded-md">
                Transaction Hash:{" "}
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CreateMatchPage() {
  return <CreateMatchForm />;
}
