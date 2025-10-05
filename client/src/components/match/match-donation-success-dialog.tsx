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
  // The match.totalAmount already includes the updated total after donation
  // We need to show the current total prize pool
  const currentPrizePool = match.totalAmount;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-w-none p-4 sm:p-6 max-h-[85vh] overflow-y-auto rounded-lg sm:rounded-xl">
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
              <span className="font-medium">Current Prize Pool:</span>{" "}
              {match.isERC20 ? (
                `${formatEther(currentPrizePool)} MATCH`
              ) : (
                <>
                  ${convertToUsd(currentPrizePool).toFixed(2)}
                  <span className="text-muted-foreground ml-1">
                    ({formatEther(currentPrizePool)} ETH)
                  </span>
                </>
              )}
            </p>
          </div>
          <PayoutSplitCard
            totalPool={currentPrizePool}
            playerStakes={match.player1Amount + match.player2Amount}
            donations={match.donatedAmount}
            isERC20={match.isERC20}
            convertEthToUsd={convertToUsd}
          />
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
