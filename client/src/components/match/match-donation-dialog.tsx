import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { OnChainMatch } from "@/types/match";
import { getMatchStatus } from "@/lib/match/types";
import { formatEther, parseEther } from "viem";

interface MatchDonationDialogProps {
  match: OnChainMatch;
  isProcessing: boolean;
  donationEthAmount: bigint;
  onDonationEthChange: (amount: bigint) => void;
  onDonate: () => Promise<void>;
  convertToUsd: (ethAmount: bigint) => number;
  convertUsdToEth: (usdAmount: number) => bigint;
}

export function MatchDonationDialog({
  match,
  isProcessing,
  donationEthAmount,
  onDonationEthChange,
  onDonate,
  convertToUsd,
  convertUsdToEth,
}: MatchDonationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState<string | undefined>();
  const [inputValue, setInputValue] = useState<string>("");

  // Fetch database status for this match
  useEffect(() => {
    const fetchDatabaseStatus = async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}/status`);
        if (response.ok) {
          const data = await response.json();
          setDatabaseStatus(data.status);
        }
      } catch { }
    };

    fetchDatabaseStatus();
  }, [match.id]);

  // Determine if donations are allowed based on match status
  const hasOpponent = match.player2 !== "0x0000000000000000000000000000000000000000";
  const status = getMatchStatus(
    match.isOpen,
    hasOpponent,
    match.matchType,
    match.teamA.length,
    match.teamB.length,
    databaseStatus
  );

  const canDonate = status === "Open" || status === "In Progress";

  // Reset input value when dialog opens
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  const handleOpenChange = useCallback((next: boolean) => {
    setIsOpen(prev => (prev === next ? prev : next));
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline" disabled={!canDonate}>
          {canDonate ? "Donate to Prize Pool" : "Match Closed"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-w-none p-4 sm:p-6 max-h-[85vh] overflow-y-auto rounded-lg sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Donate to Match #{match.id.toString()}</DialogTitle>
          <DialogDescription>
            Add to the prize pool to make this match more exciting!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="donation-amount">Donation Amount ({match.isERC20 ? "MATCH" : "USD"})</Label>
            <Input
              id="donation-amount"
              type="number"
              inputMode="decimal"
              pattern="[0-9]*"
              step="0.01"
              min="0"
              placeholder={`Enter amount in ${match.isERC20 ? "MATCH" : "USD"}`}
              value={inputValue}
              onChange={(e) => {
                const newValue = e.target.value;
                setInputValue(newValue);

                try {
                  if (match.isERC20) {
                    const value = parseEther(newValue || "0");
                    onDonationEthChange(value);
                  } else {
                    const usdAmount = parseFloat(newValue || "0");
                    if (!isFinite(usdAmount) || usdAmount <= 0) {
                      return;
                    }
                    const ethAmount = convertUsdToEth(usdAmount);
                    if (ethAmount > 0n && ethAmount < 1000000000000000000n) {
                      onDonationEthChange(ethAmount);
                    }
                  }
                } catch { }
              }}
            />
            {!match.isERC20 && (
              <p className="text-sm text-muted-foreground">
                ≈ {formatEther(donationEthAmount)} ETH
              </p>
            )}
            {match.isERC20 && (
              <p className="text-sm text-muted-foreground">
                No USD value
              </p>
            )}
          </div>
          <Button
            className="w-full"
            disabled={isProcessing || donationEthAmount <= 0n}
            onClick={async () => {
              await onDonate();
              setInputValue("");
              setIsOpen(false);
            }}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send Donation"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

