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
import PayoutSplitCard from "./payout-split";

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
  const newPool = match.totalAmount; // match already contains updated totalAmount
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
              {match.isERC20 ? (
                `${formatEther(lastDonationAmount)} MATCH`
              ) : (
                <>
                  ${convertToUsd(lastDonationAmount).toFixed(2)}
                  <span className="text-muted-foreground ml-1">
                    ({formatEther(lastDonationAmount)} ETH)
                  </span>
                </>
              )}
            </p>
            <p className="text-sm">
              <span className="font-medium">New Prize Pool:</span>{" "}
              {match.isERC20 ? (
                `${formatEther(newPool)} MATCH`
              ) : (
                <>
                  ${convertToUsd(newPool).toFixed(2)}
                  <span className="text-muted-foreground ml-1">
                    ({formatEther(newPool)} ETH)
                  </span>
                </>
              )}
            </p>
          </div>
          <PayoutSplitCard totalPool={newPool} isERC20={match.isERC20} />
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
