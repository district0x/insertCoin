import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Gift, DollarSign, Building2 } from "lucide-react";

interface MatchPayoutInfoProps {
    match: OnChainMatch;
    winnerAddress?: string;
    winnerAmount?: string;
    platformFee?: string;
    multisigFee?: string;
    convertEthToUsd: (ethAmount: bigint) => number;
}

export function MatchPayoutInfo({
    match,
    winnerAddress,
    winnerAmount,
    platformFee,
    multisigFee,
    convertEthToUsd,
}: MatchPayoutInfoProps) {
    const truncateAddress = (address: string) => {
        if (!address) return "N/A";
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // CRITICAL: Separate player stakes from donations
    const totalStake = match.player1Amount + match.player2Amount;
    const donations = match.donatedAmount;
    const totalPrizePool = totalStake + donations;

    // Only apply 80/15/5 split to player stakes, NOT donations
    const winnerStakeShare = (totalStake * 80n) / 100n;
    const contractFee = (totalStake * 15n) / 100n;
    const multisigShare = (totalStake * 5n) / 100n;

    // Donations go 100% to winner (no platform fees)
    const totalWinnerAmount = winnerStakeShare + donations;

    // Add comprehensive logging for payout verification
    console.log(`[PAYOUT-CALC] Match ${match.id} payout breakdown:`, {
        player1Amount: match.player1Amount.toString(),
        player2Amount: match.player2Amount.toString(),
        donatedAmount: donations.toString(),
        totalStake: totalStake.toString(),
        totalPrizePool: totalPrizePool.toString(),
        winnerStakeShare: winnerStakeShare.toString(),
        totalWinnerAmount: totalWinnerAmount.toString(),
        contractFee: contractFee.toString(),
        multisigShare: multisigShare.toString(),
        totalCalculated: (totalWinnerAmount + contractFee + multisigShare).toString(),
        isERC20: match.isERC20,
        winnerAddress,
        apiWinnerAmount: winnerAmount,
        calculatedWinnerAmount: formatEther(totalWinnerAmount),
        validation: {
            totalShouldEqualPrizePool: (totalWinnerAmount + contractFee + multisigShare) === totalPrizePool,
            winnerStakeShouldBe80Percent: (winnerStakeShare * 100n) / totalStake === 80n,
            feesShouldBe20PercentOfStakes: ((contractFee + multisigShare) * 100n) / totalStake === 20n,
            donationsGoToWinner: donations === 0n || totalWinnerAmount === winnerStakeShare + donations
        }
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
                {donations > 0n && (
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2">
                            <Gift className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium">Donations (100% to Winner)</span>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold">
                                +{formatEther(donations)} {match.isERC20 ? "MATCH" : "ETH"}
                            </div>
                            {!match.isERC20 && (
                                <div className="text-xs text-muted-foreground">
                                    ≈ ${convertEthToUsd(donations).toFixed(2)} USD
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
                                        {formatEther(totalWinnerAmount)} {match.isERC20 ? "MATCH" : "ETH"}
                                    </div>
                                    {!match.isERC20 && (
                                        <div className="text-xs text-muted-foreground">
                                            ≈ ${convertEthToUsd(totalWinnerAmount).toFixed(2)} USD
                                        </div>
                                    )}
                                </div>
                            </div>
                            {donations > 0n && (
                                <div className="text-xs text-blue-400 text-center">
                                    Includes 80% of stakes + 100% of donations
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Contract Fees */}
                <div className="space-y-3 p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Platform Fees (Stakes Only)</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Contract Fee (15%):</span>
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
                            <span className="text-xs text-muted-foreground">Multisig (5%):</span>
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
                    <p>Payout Breakdown: 80% Winner (stakes) + 100% Donations • 15% Platform (stakes only) • 5% Multisig (stakes only)</p>
                </div>
            </CardContent>
        </Card>
    );
} 