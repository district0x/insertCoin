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

interface MatchDonationDialogProps {
  match: OnChainMatch;
  isProcessing: boolean;
  donationEthAmount: bigint;
  onDonationEthChange: (amount: bigint) => void;
  onDonate: () => Promise<void>;
}

export function MatchDonationDialog({
  match,
  isProcessing,
  donationEthAmount,
  onDonationEthChange,
  onDonate,
}: MatchDonationDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={!match.isOpen}>
          Donate to Match
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Donate to Match #{match.id.toString()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <UsdInput
            label="Donation Amount (USD)"
            onEthChange={onDonationEthChange}
            placeholder="Enter amount in USD"
            disabled={isProcessing}
            required
          />
          <Button
            className="w-full"
            disabled={isProcessing || donationEthAmount === BigInt(0)}
            onClick={onDonate}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirm Donation"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
