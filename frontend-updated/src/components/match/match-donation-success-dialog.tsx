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
}

export function MatchDonationSuccessDialog({
  match,
  lastDonationAmount,
  open,
  onOpenChange,
}: MatchDonationSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Donation Successful!</DialogTitle>
          <DialogDescription>
            Your donation of {formatEther(lastDonationAmount)} ETH has been
            added to the match.
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">
                Match #{match.id.toString()} Details:
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p>Total Prize Pool: {formatEther(match.totalAmount)} ETH</p>
                <p>Total Donations: {formatEther(match.donatedAmount)} ETH</p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Button onClick={() => onOpenChange(false)}>Close</Button>
      </DialogContent>
    </Dialog>
  );
}
