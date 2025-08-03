import { useState, useEffect } from "react";
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
  const [databaseStatus, setDatabaseStatus] = useState<string | undefined>();

  // Fetch database status for this match
  useEffect(() => {
    const fetchDatabaseStatus = async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}/status`);
        if (response.ok) {
          const data = await response.json();
          setDatabaseStatus(data.status);
        }
      } catch (error) {
        console.error("Error fetching database status:", error);
      }
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
            Add to the prize pool to make this match more exciting!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="donation-amount">Donation Amount ({match.isERC20 ? "MATCH" : "ETH"})</Label>
            <Input
              id="donation-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder={`Enter amount in ${match.isERC20 ? "MATCH" : "ETH"}`}
              value={formatEther(donationEthAmount)}
              onChange={(e) => {
                try {
                  const value = parseEther(e.target.value || "0");
                  onDonationEthChange(value);
                } catch {
                  // Invalid input, ignore
                }
              }}
            />
            {!match.isERC20 && (
              <p className="text-sm text-muted-foreground">
                ≈ ${convertToUsd(donationEthAmount).toFixed(2)} USD
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
