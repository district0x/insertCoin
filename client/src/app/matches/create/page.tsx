"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMatch } from "@/lib/hooks/useMatch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { updateMatchWithWallet, createMatchInDb, updateMatchWithContractId } from "@/lib/services/match";
import { formatEther, decodeEventLog } from "viem";
import { MatchType } from "@/types/match";
import { UsdInput } from "@/components/ui/usd-input";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";
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
import { usePrivy } from "@privy-io/react-auth";

// type MatchEventArgs = {
//   matchId: bigint;
//   player1: `0x${string}`;
//   matchAmount: bigint;
// };

// A reasonable max stake for a match (100 ETH or equivalent)
const MAX_STAKE_AMOUNT = 100n * 10n ** 18n; // 100 ETH in wei

function CreateMatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { address, isConnected, ready } = useWalletConnection();
  const { user } = usePrivy();

  // Debug logging
  console.log("CreateMatchForm - address from useWalletConnection:", address);
  console.log("CreateMatchForm - user.wallet.address:", user?.wallet?.address);
  console.log("CreateMatchForm - isConnected:", isConnected);
  console.log("CreateMatchForm - ready:", ready);

  // Get roomId and ethAmount from URL
  const roomId = searchParams.get("roomId");
  const ethAmountParam = searchParams.get("ethAmount");
  const [matchType, setMatchType] = React.useState<MatchType>("ONE_V_ONE");
  const [ethAmount, setEthAmount] = React.useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = React.useState(false);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [isWaitingForTx, setIsWaitingForTx] = React.useState(false);
  const [selectedToken, setSelectedToken] = React.useState<TokenOption>("ETH");
  const [paramError, setParamError] = React.useState<string | null>(null);
  const { createMatch, create2v2Match, create5v5Match } = useMatch();

  // Get the actual wallet address to use (fallback to user.wallet.address if address is null)
  const walletAddress = address || user?.wallet?.address;

  // On mount, set ethAmount from URL if roomId is present
  React.useEffect(() => {
    if (roomId) {
      if (!ethAmountParam || isNaN(Number(ethAmountParam)) || Number(ethAmountParam) <= 0) {
        setParamError("Invalid or missing match amount. Please use a valid Discord match link.");
        setEthAmount(BigInt(0));
      } else {
        setEthAmount(BigInt(Math.floor(Number(ethAmountParam) * 1e18)));
        setParamError(null);
      }
    }
  }, [roomId, ethAmountParam]);

  // Create public client directly
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
  });

  // Check if user is connected when accessing the page
  React.useEffect(() => {
    if (ready && !isConnected) {
      toast({
        title: "Wallet Connection Required",
        description: "Please connect your wallet to create a match.",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [ready, isConnected, toast]);

  // Watch for transaction confirmation
  React.useEffect(() => {
    if (!txHash || !publicClient) return;

    const watchTransaction = async () => {
      try {
        setIsWaitingForTx(true);

        // Add a more detailed status message
        toast({
          title: "Transaction Submitted",
          description: `Waiting for transaction to be confirmed on Base Sepolia. This may take a few minutes.`,
          duration: 30000, // Show for longer since blockchain confirmations take time
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
          // Increase timeout to 3 minutes (180000ms) for Base Sepolia which can be slow
          timeout: 180000,
          // Poll more frequently to catch confirmations faster
          pollingInterval: 3000,
          // Add confirmation blocks for extra security
          confirmations: 1,
        });

        setIsWaitingForTx(false);

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

          // Decode the event
          const result = decodeEventLog({
            abi: ONEVONE_ABI,
            data: matchEvent.data,
            topics: matchEvent.topics,
          });

          // Cast to unknown first, then to the expected shape
          const decoded = result as unknown as {
            eventName: string;
            args: [bigint, `0x${string}`, bigint, ...unknown[]];
          };

          // The first argument is the match ID
          const onChainMatchId = decoded.args[0].toString();

          // If this was a Discord-created match, update it with the contract match ID
          if (roomId) {
            try {
              await updateMatchWithContractId({
                roomId,
                contractMatchId: Number(onChainMatchId),
              });
              console.log(`Updated Discord match ${roomId} with contract match ID ${onChainMatchId}`);
            } catch (error) {
              console.error("Error updating Discord match with contract ID:", error);
              // Don't fail the whole process if this update fails
            }
          } else {
            // Regular match creation - create database entry
            await createMatchInDb({
              walletAddress: walletAddress as string,
              matchType,
              stake: formatEther(ethAmount),
              matchId: Number(onChainMatchId),
              tokenAddress: selectedToken === "MTK" ? MTK_TOKEN.address : null,
            });
          }

          toast({
            title: "Match Created Successfully!",
            description: `Your ${matchType.toLowerCase()} match with ID #${onChainMatchId} is now live with a stake of ${formatEther(
              ethAmount
            )} ${selectedToken}.`,
            variant: "success",
            duration: 5000, // Show for 5 seconds to ensure user sees it
          });

          // Redirect to the match page after a short delay
          setTimeout(() => {
            router.push(`/matches/${onChainMatchId}`);
          }, 1500);
        }
      } catch (error) {
        setIsLoading(false);
        setIsWaitingForTx(false);
        console.error("Transaction error:", error);

        // Check if it's a timeout error
        if (error instanceof Error && error.message.includes("Timed out")) {
          toast({
            title: "Transaction Taking Longer Than Expected",
            description: `The transaction is taking longer than expected to confirm. You can check the status on the Base Sepolia explorer: https://sepolia.basescan.org/tx/${txHash}`,
            variant: "destructive",
            duration: 10000,
          });
        } else {
          toast({
            title: "Transaction Failed",
            description:
              error instanceof Error
                ? `Failed to create match: ${error.message}`
                : "Failed to create match. The transaction was not processed correctly. Please try again.",
            variant: "destructive",
            duration: 7000, // Show longer for errors
          });
        }
      }
    };

    watchTransaction();
  }, [
    txHash,
    publicClient,
    matchType,
    walletAddress,
    ethAmount,
    router,
    toast,
    selectedToken,
    roomId,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !walletAddress) {
      toast({
        title: "External Wallet Required",
        description: "Please connect your external wallet (like MetaMask) to create matches. Embedded wallets are not supported.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    if (isLoading) return;

    if (ethAmount <= 0n) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a stake amount greater than 0.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    if (ethAmount > MAX_STAKE_AMOUNT) {
      toast({
        title: "Amount Too Large",
        description:
          "The stake amount is too large. Please enter a smaller amount.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    try {
      // If roomId exists, this is a Discord-created match
      if (roomId) {
        if (!walletAddress) {
          throw new Error("Wallet address is required");
        }

        console.log("About to call updateMatchWithWallet with:", {
          roomId,
          walletAddress,
          roomIdType: typeof roomId,
          walletAddressType: typeof walletAddress
        });

        const updatedMatch = await updateMatchWithWallet({
          roomId,
          walletAddress: walletAddress as string,
        });

        if (!updatedMatch) {
          throw new Error("Failed to update match");
        }

        // For Discord-created matches, we currently only support ETH
        const hash = await createMatch(ethAmount);
        if (!hash) throw new Error("Failed to create match");

        setTxHash(hash);

        toast({
          title: "Transaction Submitted",
          description: `Creating your ${matchType.toLowerCase()} match. Please wait for blockchain confirmation...`,
          duration: 10000, // Show for longer since blockchain confirmations take time
        });
      } else {
        // Regular match creation (not from Discord)
        let hash: string | null = null;

        if (matchType === "ONE_V_ONE") {
          hash = await createMatch(ethAmount);
        } else if (matchType === "TWO_V_TWO") {
          hash = await create2v2Match(ethAmount);
        } else if (matchType === "FIVE_V_FIVE") {
          hash = await create5v5Match(ethAmount);
        }

        if (!hash) throw new Error("Failed to create match");

        setTxHash(hash);

        toast({
          title: "Transaction Submitted",
          description: `Creating your ${matchType.toLowerCase()} match. Please wait for blockchain confirmation...`,
          duration: 10000,
        });
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error creating match:", error);

      toast({
        title: "Error Creating Match",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
        duration: 5000,
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
              {roomId ? "Link Wallet to Discord Match" : "Create New Match"}
            </CardTitle>
            <CardDescription className="text-base">
              {roomId
                ? "Connect your wallet to create the match from Discord"
                : "Choose your match type and stake amount"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paramError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {paramError}
              </div>
            )}
            {!isConnected && (
              <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded">
                Please connect your external wallet to continue.
              </div>
            )}
            {isConnected && !address && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                <strong>External Wallet Required</strong><br />
                You need to connect an external wallet (like MetaMask) to create matches.
                Embedded wallets are not supported for transactions.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8">
              {!roomId && (
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
                        <SelectItem value="ONE_V_ONE">1v1 Match</SelectItem>
                        <SelectItem value="TWO_V_TWO">2v2 Match</SelectItem>
                        <SelectItem value="FIVE_V_FIVE">5v5 Match</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Token</Label>
                    <RadioGroup
                      value={selectedToken}
                      onValueChange={(value) =>
                        setSelectedToken(value as TokenOption)
                      }
                      className="flex space-x-6 pt-2"
                      disabled={isLoading}
                    >
                      {TOKEN_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          className="flex items-center space-x-2"
                        >
                          <RadioGroupItem
                            value={option.value}
                            id={option.value.toLowerCase()}
                          />
                          <Label
                            htmlFor={option.value.toLowerCase()}
                            className="cursor-pointer font-medium"
                          >
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
                      // Add validation for min/max amounts (in USD)
                      min={1}
                      max={1000000} // $1M max stake as a reasonable limit
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {ethAmount > BigInt(0) && (
                        <>
                          ≈ {formatEther(ethAmount)} {selectedToken}
                          {ethAmount > MAX_STAKE_AMOUNT && (
                            <span className="text-red-500 ml-1">
                              (Amount too large)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </>
              )}
              {roomId && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Stake Amount (ETH)</Label>
                  <input
                    type="text"
                    value={ethAmountParam || ""}
                    disabled
                    className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                </div>
              )}
              <Button
                type="submit"
                className="w-full py-6 text-base font-medium"
                disabled={isLoading || (!roomId && ethAmount === BigInt(0)) || !!paramError || !isConnected}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isWaitingForTx
                      ? "Waiting for confirmation..."
                      : "Creating match..."}
                  </span>
                ) : roomId ? (
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
  return (
    <React.Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[calc(100vh-80px)]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ErrorBoundary
        fallback={
          <div className="flex justify-center items-center min-h-[calc(100vh-80px)]">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
              <p className="text-muted-foreground mb-4">
                There was an error loading the match creation page.
              </p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        }
      >
        <CreateMatchForm />
      </ErrorBoundary>
    </React.Suspense>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', _error, _errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
