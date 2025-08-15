"use client";

import * as React from "react";
import { formatEther } from "viem";
import { ExternalLink, Trophy } from "lucide-react";

interface PayoutSplitProps {
    totalPool: bigint; // prize pool in wei/token units
    isERC20: boolean; // true => MATCH, false => ETH
    convertEthToUsd?: (ethAmount: bigint) => number; // Function to convert ETH to USD
}

const CONTRACT_ADDR = "0xC24Cea38b8D6e7303DFfA7d5bc309FE5f8FCaD08" as const;
const EXPLORER_URL = `https://sepolia.basescan.org/address/${CONTRACT_ADDR}` as const;

export default function PayoutSplitCard({ totalPool, isERC20, convertEthToUsd }: PayoutSplitProps) {
    // Exact bigint math keeps totals precise - Updated to 80% + 15% + 5%
    const winnerRaw = (totalPool * 80n) / 100n;
    const contractFeeRaw = (totalPool * 15n) / 100n;
    const multisigRaw = (totalPool * 5n) / 100n; // Fixed to exactly 5%

    let winnerDisplay = "";
    let contractDisplay = "";
    let multisigDisplay = "";

    if (isERC20) {
        // Show fractional MATCH values to keep the split honest
        const fmt = (v: bigint) => Number(formatEther(v)).toFixed(4) + " MATCH";
        winnerDisplay = fmt(winnerRaw);
        contractDisplay = fmt(contractFeeRaw);
        multisigDisplay = fmt(multisigRaw);
    } else {
        // ETH with USD conversion - show USD first, ETH in parentheses
        if (convertEthToUsd) {
            const toEthWithUsd = (v: bigint) => {
                const ethAmount = Number(formatEther(v)).toFixed(6);
                const usdAmount = convertEthToUsd(v).toFixed(2);
                return `$${usdAmount} USD (${ethAmount} ETH)`;
            };
            winnerDisplay = toEthWithUsd(winnerRaw);
            contractDisplay = toEthWithUsd(contractFeeRaw);
            multisigDisplay = toEthWithUsd(multisigRaw);
        } else {
            // Fallback to ETH only if no conversion function provided
            const toEth = (v: bigint) => Number(formatEther(v)).toFixed(6) + " ETH";
            winnerDisplay = toEth(winnerRaw);
            contractDisplay = toEth(contractFeeRaw);
            multisigDisplay = toEth(multisigRaw);
        }
    }

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-black/30 border border-red-500/10 p-3">
                    <div className="text-xs text-gray-400">Winner (80%)</div>
                    <div className="text-sm font-semibold text-white mt-1">{winnerDisplay}</div>
                </div>
                <div className="rounded-lg bg-black/30 border border-red-500/10 p-3">
                    <div className="text-xs text-gray-400">Contract Fee (15%)</div>
                    <div className="text-sm font-semibold text-white mt-1">{contractDisplay}</div>
                </div>
                <div className="rounded-lg bg-black/30 border border-red-500/10 p-3">
                    <div className="text-xs text-gray-400">Multisig (5%)</div>
                    <div className="text-sm font-semibold text-white mt-1">{multisigDisplay}</div>
                </div>
            </div>
        </div>
    );
} 