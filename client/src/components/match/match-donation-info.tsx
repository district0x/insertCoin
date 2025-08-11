import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { Gift } from "lucide-react";

interface MatchDonationInfoProps {
    match: OnChainMatch;
    convertToUsd: (ethAmount: bigint) => number;
}

export function MatchDonationInfo({
    match,
    convertToUsd,
}: MatchDonationInfoProps) {
    const hasDonations = match.donatedAmount > BigInt(0);

    if (!hasDonations) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Donations</h3>
                <div className="bg-gradient-to-r from-gray-900/80 to-black/80 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Gift className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">No donations yet</span>
                    </div>
                    <p className="text-sm text-gray-500">
                        Be the first to donate to this match!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Donations</h3>
            <div className="bg-gradient-to-r from-green-500/20 to-green-500/10 rounded-lg p-4 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                    <Gift className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">Total Donations</span>
                </div>
                <p className="text-lg font-bold text-white">
                    {match.isERC20
                        ? `+${formatEther(match.donatedAmount)} MATCH`
                        : `+$${convertToUsd(match.donatedAmount).toFixed(2)} (${formatEther(match.donatedAmount)} ETH)`
                    }
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    {match.isERC20
                        ? "MATCH tokens donated to the prize pool"
                        : "ETH donated to the prize pool"
                    }
                </p>
            </div>
        </div>
    );
} 