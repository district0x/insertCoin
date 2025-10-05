"use client";

import * as React from "react";
import { formatEther } from "viem";
import { ExternalLink, Trophy, Gift } from "lucide-react";

interface PayoutSplitProps {
    totalPool: bigint; // prize pool in wei/token units (stakes + donations)
    playerStakes: bigint; // only player stakes (player1 + player2 amounts)
    donations: bigint; // only donation amounts
    isERC20: boolean; // true => MATCH, false => ETH
    convertEthToUsd?: (ethAmount: bigint) => number; // Function to convert ETH to USD
}

const CONTRACT_ADDR = "0xC24Cea38b8D6e7303DFfA7d5bc309FE5f8FCaD08" as const;
const EXPLORER_URL = `https://sepolia.basescan.org/address/${CONTRACT_ADDR}` as const;

export default function PayoutSplitCard({
    totalPool,
    playerStakes,
    donations,
    isERC20,
    convertEthToUsd
}: PayoutSplitProps) {
    // CRITICAL: Only apply 80/15/5 split to player stakes, NOT donations
    const winnerStakeShare = (playerStakes * 80n) / 100n;
    const contractFeeRaw = (playerStakes * 15n) / 100n;
    const multisigRaw = (playerStakes * 5n) / 100n;

    // Donations go 100% to winner (no platform fees)
    const totalWinnerAmount = winnerStakeShare + donations;

    let winnerDisplay = "";
    let contractDisplay = "";
    let multisigDisplay = "";
    let donationsDisplay = "";

    if (isERC20) {
        // Show fractional MATCH values to keep the split honest
        const fmt = (v: bigint) => Number(formatEther(v)).toFixed(4) + " MATCH";
        winnerDisplay = fmt(totalWinnerAmount);
        contractDisplay = fmt(contractFeeRaw);
        multisigDisplay = fmt(multisigRaw);
        donationsDisplay = donations > 0n ? fmt(donations) : "";
    } else {
        // ETH with USD conversion - show USD first, ETH in parentheses
        if (convertEthToUsd) {
            const toEthWithUsd = (v: bigint) => {
                const ethAmount = Number(formatEther(v)).toFixed(6);
                const usdAmount = convertEthToUsd(v).toFixed(2);
                return `$${usdAmount} USD (${ethAmount} ETH)`;
            };
            winnerDisplay = toEthWithUsd(totalWinnerAmount);
            contractDisplay = toEthWithUsd(contractFeeRaw);
            multisigDisplay = toEthWithUsd(multisigRaw);
            donationsDisplay = donations > 0n ? toEthWithUsd(donations) : "";
        } else {
            // Fallback to ETH only if no conversion function provided
            const toEth = (v: bigint) => Number(formatEther(v)).toFixed(6) + " ETH";
            winnerDisplay = toEth(totalWinnerAmount);
            contractDisplay = toEth(contractFeeRaw);
            multisigDisplay = toEth(multisigRaw);
            donationsDisplay = donations > 0n ? toEth(donations) : "";
        }
    }

    // Add comprehensive logging for payout verification
    console.log(`[PAYOUT-SPLIT] Detailed breakdown:`, {
        totalPool: totalPool.toString(),
        playerStakes: playerStakes.toString(),
        donations: donations.toString(),
        winnerStakeShare: winnerStakeShare.toString(),
        totalWinnerAmount: totalWinnerAmount.toString(),
        contractFee: contractFeeRaw.toString(),
        multisigFee: multisigRaw.toString(),
        validation: {
            totalShouldEqualPrizePool: (totalWinnerAmount + contractFeeRaw + multisigRaw) === totalPool,
            winnerStakeShouldBe80Percent: (winnerStakeShare * 100n) / playerStakes === 80n,
            feesShouldBe20PercentOfStakes: ((contractFeeRaw + multisigRaw) * 100n) / playerStakes === 20n,
            donationsGoToWinner: donations === 0n || totalWinnerAmount === winnerStakeShare + donations
        }
    });

    return (
        <div className="bg-gradient-to-br from-gray-900/80 to-black/80 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-red-400" />
                    <span className="font-semibold text-white">Payouts</span>
                </div>
                <a
                    href={EXPLORER_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-red-400 hover:underline inline-flex items-center gap-1"
                >
                    Contract
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            {/* Show donations separately if they exist */}
            {donations > 0n && (
                <div className="mb-3 p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-2 text-xs text-blue-300">
                        <Gift className="h-3 w-3" />
                        <span>Donations go 100% to winner (no platform fees)</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-black/30 border border-red-500/10 p-3">
                    <div className="text-xs text-gray-400">Winner</div>
                    <div className="text-sm font-semibold text-white mt-1">{winnerDisplay}</div>
                    <div className="text-xs text-gray-400 mt-1">
                        {donations > 0n ? "80% of stakes + 100% of donations" : "80% of stakes"}
                    </div>
                </div>
                <div className="rounded-lg bg-black/30 border border-red-500/10 p-3">
                    <div className="text-xs text-gray-400">Platform Fee (15%)</div>
                    <div className="text-sm font-semibold text-white mt-1">{contractDisplay}</div>
                    <div className="text-xs text-gray-400 mt-1">15% of stakes only</div>
                </div>
                <div className="rounded-lg bg-black/30 border border-red-500/10 p-3">
                    <div className="text-xs text-gray-400">Multisig (5%)</div>
                    <div className="text-sm font-semibold text-white mt-1">{multisigDisplay}</div>
                    <div className="text-xs text-gray-400 mt-1">5% of stakes only</div>
                </div>
            </div>
        </div>
    );
} 