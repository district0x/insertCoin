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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline" disabled={!match.isOpen}>
          {match.isOpen ? "Donate to Prize Pool" : "Match Closed"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Donate to Match #{match.id.toString()}</DialogTitle>
          <DialogDescription>
            Current prize pool: {formatEther(match.totalAmount)} ETH
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
                  ≈ {formatEther(donationEthAmount)} ETH
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
