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

interface MatchCloseDialogProps {
  match: OnChainMatch;
  isProcessing: boolean;
  selectedWinner: `0x${string}` | null;
  onSelectWinner: (winner: `0x${string}`) => void;
  onClose: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MatchCloseDialog({
  match,
  isProcessing,
  selectedWinner,
  onSelectWinner,
  onClose,
  open,
  onOpenChange,
}: MatchCloseDialogProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full" disabled={isProcessing}>
          Close Match
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Match #{match.id.toString()}</DialogTitle>
          <DialogDescription>
            Select the winner of this match. This action cannot be undone.
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
