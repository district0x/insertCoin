import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";

interface MatchDonationSuccessDialogProps {
  match: OnChainMatch;
  lastDonationAmount: bigint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  convertToUsd: (ethAmount: bigint) => number;
}

export function MatchDonationSuccessDialog({
  match,
  lastDonationAmount,
  open,
  onOpenChange,
  convertToUsd,
}: MatchDonationSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Donation Successful!</DialogTitle>
          <DialogDescription>
            Thank you for your donation to Match #{match.id.toString()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm">
              <span className="font-medium">Your Donation:</span>{" "}
              {formatEther(lastDonationAmount)} {match.isERC20 ? "MTK" : "ETH"}
              <span className="text-muted-foreground ml-1">
                (≈${convertToUsd(lastDonationAmount).toFixed(2)})
              </span>
            </p>
            <p className="text-sm">
              <span className="font-medium">New Prize Pool:</span>{" "}
              {formatEther(match.totalAmount)} {match.isERC20 ? "MTK" : "ETH"}
              <span className="text-muted-foreground ml-1">
                (≈${convertToUsd(match.totalAmount).toFixed(2)})
              </span>
            </p>
          </div>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
