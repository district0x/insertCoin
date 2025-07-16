import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { UsdInput } from "@/components/ui/usd-input";
import { OnChainMatch } from "@/types/match";
import { useState } from "react";
import { DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatEther } from "viem";
import { getMatchStatus } from "@/lib/match/types";

interface MatchDonationDialogProps {
  match: OnChainMatch;
  isProcessing: boolean;
  donationEthAmount: bigint;
  onDonationEthChange: (amount: bigint) => void;
  onDonate: () => Promise<void>;
  convertToUsd: (ethAmount: bigint) => number;
}

export function MatchDonationDialog({
  match,
  isProcessing,
  donationEthAmount,
  onDonationEthChange,
  onDonate,
  convertToUsd,
}: MatchDonationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Determine if donations are allowed based on match status
  const hasOpponent = match.player2 !== "0x0000000000000000000000000000000000000000";
  const status = getMatchStatus(
    match.isOpen,
    hasOpponent,
    match.matchType,
    match.teamA.length,
    match.teamB.length
  );
  
  const canDonate = status === "Open" || status === "In Progress";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline" disabled={!canDonate}>
          {canDonate ? "Donate to Prize Pool" : "Match Closed"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Donate to Match #{match.id.toString()}</DialogTitle>
          <DialogDescription>
            Current prize pool: {formatEther(match.totalAmount)} {match.isERC20 ? "MTK" : "ETH"}
            <span className="text-muted-foreground ml-1">
              (≈${convertToUsd(match.totalAmount).toFixed(2)})
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Donation Amount</Label>
            <UsdInput
              onEthChange={onDonationEthChange}
              placeholder="Enter donation amount in USD"
              disabled={isProcessing}
            />
            <p className="text-sm text-muted-foreground">
              {donationEthAmount > BigInt(0) && (
                <>
                  ≈ {formatEther(donationEthAmount)} {match.isERC20 ? "MTK" : "ETH"}
                  <span className="ml-1">
                    (≈${convertToUsd(donationEthAmount).toFixed(2)})
                  </span>
                </>
              )}
            </p>
          </div>

          <Button
            className="w-full"
            disabled={isProcessing || donationEthAmount === BigInt(0)}
            onClick={async () => {
              await onDonate();
              setIsOpen(false);
            }}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Donate"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
