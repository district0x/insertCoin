import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { OnChainMatch } from "@/types/match";
import { formatEther } from "viem";
import PayoutSplitCard from "./payout-split";

interface MatchCloseDialogProps {
  match: OnChainMatch;
  isProcessing: boolean;
  selectedWinner: `0x${string}` | null;
  onSelectWinner: (winner: `0x${string}`) => void;
  onClose: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  convertToUsd: (ethAmount: bigint) => number;
}

export function MatchCloseDialog({
  match,
  isProcessing,
  selectedWinner,
  onSelectWinner,
  onClose,
  open,
  onOpenChange,
  convertToUsd,
}: MatchCloseDialogProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const totalPool = match.totalAmount;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full" disabled={isProcessing}>
          Close Match
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-w-none p-4 sm:p-6 max-h-[85vh] overflow-y-auto rounded-lg sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Close Match #{match.id.toString()}</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Select the winner of this match. This action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              Prize Pool: {formatEther(match.totalAmount)} {match.isERC20 ? "MATCH" : "ETH"} ($
              {convertToUsd(match.totalAmount).toFixed(2)})
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={selectedWinner === match.player1 ? "default" : "outline"}
              className="w-full"
              onClick={() => onSelectWinner(match.player1)}
            >
              Player 1 Won
              <span className="block text-xs mt-1">
                {truncateAddress(match.player1)}
              </span>
            </Button>
            <Button
              variant={selectedWinner === match.player2 ? "default" : "outline"}
              className="w-full"
              onClick={() => onSelectWinner(match.player2)}
            >
              Player 2 Won
              <span className="block text-xs mt-1">
                {truncateAddress(match.player2)}
              </span>
            </Button>
          </div>

          <PayoutSplitCard
            totalPool={totalPool}
            isERC20={match.isERC20}
            convertEthToUsd={convertToUsd}
          />

          <Button
            className="w-full"
            disabled={isProcessing || !selectedWinner}
            onClick={onClose}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirm Winner"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
