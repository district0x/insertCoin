import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Gift, DollarSign, Building2 } from "lucide-react";

interface MatchPayoutInfoProps {
    match: OnChainMatch;
    winnerAddress?: string;
    winnerAmount?: string;
    poolAmount?: string;
    convertEthToUsd: (ethAmount: bigint) => number;
}

export function MatchPayoutInfo({
    match,
    winnerAddress,
    winnerAmount,
    poolAmount,
    convertEthToUsd,
}: MatchPayoutInfoProps) {
    const truncateAddress = (address: string) => {
        if (!address) return "N/A";
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // Calculate total stake (player1 + player2 amounts)
    const totalStake = match.player1Amount + match.player2Amount;

    // Calculate total prize pool (stake + donations)
    const totalPrizePool = totalStake + match.donatedAmount;

    // Calculate contract fee (10% of total prize pool)
    const contractFee = (totalPrizePool * 10n) / 100n;

    // Calculate winner share (80% of total prize pool)
    const winnerShare = (totalPrizePool * 80n) / 100n;

    // Calculate multisig share (10% of total prize pool)
    const multisigShare = (totalPrizePool * 10n) / 100n;

    // Add comprehensive logging for payout verification
    console.log(`[PAYOUT-CALC] Match ${match.id} payout breakdown:`, {
        player1Amount: match.player1Amount.toString(),
        player2Amount: match.player2Amount.toString(),
        donatedAmount: match.donatedAmount.toString(),
        totalStake: totalStake.toString(),
        totalPrizePool: totalPrizePool.toString(),
        winnerShare: winnerShare.toString(),
        contractFee: contractFee.toString(),
        multisigShare: multisigShare.toString(),
        totalCalculated: (winnerShare + contractFee + multisigShare).toString(),
        isERC20: match.isERC20,
        winnerAddress,
        winnerAmount,
        expectedWinnerAmount: formatEther(winnerShare)
    });

    return (
        <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Payout Information
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Total Stake */}
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium">Total Stake</span>
                    </div>
                    <div className="text-right">
                        <div className="font-semibold">
                            {formatEther(totalStake)} {match.isERC20 ? "MATCH" : "ETH"}
                        </div>
                        {!match.isERC20 && (
                            <div className="text-xs text-muted-foreground">
                                ≈ ${convertEthToUsd(totalStake).toFixed(2)} USD
                            </div>
                        )}
                    </div>
                </div>

                {/* Donations */}
                {match.donatedAmount > 0n && (
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2">
                            <Gift className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium">Donations</span>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold">
                                +{formatEther(match.donatedAmount)} {match.isERC20 ? "MATCH" : "ETH"}
                            </div>
                            {!match.isERC20 && (
                                <div className="text-xs text-muted-foreground">
                                    ≈ ${convertEthToUsd(match.donatedAmount).toFixed(2)} USD
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Total Prize Pool */}
                <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium">Total Prize Pool</span>
                    </div>
                    <div className="text-right">
                        <div className="font-semibold">
                            {formatEther(totalPrizePool)} {match.isERC20 ? "MATCH" : "ETH"}
                        </div>
                        {!match.isERC20 && (
                            <div className="text-xs text-muted-foreground">
                                ≈ ${convertEthToUsd(totalPrizePool).toFixed(2)} USD
                            </div>
                        )}
                    </div>
                </div>

                {/* Winner Information */}
                {winnerAddress && (
                    <div className="space-y-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">Winner</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Address:</span>
                                <span className="text-xs font-mono">{truncateAddress(winnerAddress)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Amount:</span>
                                <div className="text-right">
                                    <div className="text-sm font-semibold">
                                        {winnerAmount} {match.isERC20 ? "MATCH" : "ETH"}
                                    </div>
                                    {!match.isERC20 && winnerAmount && (
                                        <div className="text-xs text-muted-foreground">
                                            ≈ ${convertEthToUsd(BigInt(Math.floor(Number(winnerAmount) * 1e18))).toFixed(2)} USD
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Contract Fees */}
                <div className="space-y-3 p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Platform Fees</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Contract Fee (10%):</span>
                            <div className="text-right">
                                <div className="text-sm font-semibold">
                                    {formatEther(contractFee)} {match.isERC20 ? "MATCH" : "ETH"}
                                </div>
                                {!match.isERC20 && (
                                    <div className="text-xs text-muted-foreground">
                                        ≈ ${convertEthToUsd(contractFee).toFixed(2)} USD
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Multisig (10%):</span>
                            <div className="text-right">
                                <div className="text-sm font-semibold">
                                    {formatEther(multisigShare)} {match.isERC20 ? "MATCH" : "ETH"}
                                </div>
                                {!match.isERC20 && (
                                    <div className="text-xs text-muted-foreground">
                                        ≈ ${convertEthToUsd(multisigShare).toFixed(2)} USD
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payout Breakdown */}
                <div className="text-xs text-muted-foreground text-center">
                    <p>Payout Breakdown: 80% Winner • 10% Platform • 10% Multisig</p>
                </div>
            </CardContent>
        </Card>
    );
} 