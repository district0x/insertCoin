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
import { formatEther } from "viem";
import { OnChainMatch } from "@/types/match";
import { useState } from "react";

interface MatchJoinDialogProps {
  match: OnChainMatch;
  isProcessing: boolean;
  userAddress?: `0x${string}`;
  onJoin: (isTeamA: boolean) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MatchJoinDialog({
  match,
  isProcessing,
  userAddress,
  onJoin,
  open,
  onOpenChange,
}: MatchJoinDialogProps) {
  const [selectedTeam, setSelectedTeam] = useState<"A" | "B" | null>(null);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRequiredPlayers = () => {
    return match.matchType === "FIVE_V_FIVE"
      ? 5
      : match.matchType === "TWO_V_TWO"
      ? 2
      : 1;
  };

  const getTeamSpots = () => {
    const required = getRequiredPlayers();
    return {
      teamA: required - match.teamA.length,
      teamB: required - match.teamB.length,
    };
  };

  const getJoinButtonText = () => {
    if (!userAddress) {
      return "Connect Wallet to Join";
    }

    if (
      match.teamA.includes(userAddress as `0x${string}`) ||
      match.teamB.includes(userAddress as `0x${string}`)
    ) {
      return "Already in Match";
    }

    const spots = getTeamSpots();

    if (spots.teamA === 0 && spots.teamB === 0) {
      return "Teams Full";
    }

    if (match.matchType === "ONE_V_ONE") {
      return `Join Match with ${formatEther(match.player1Amount)} ETH`;
    }

    return `Join Match with ${formatEther(match.player1Amount)} ETH`;
  };

  const isJoinButtonDisabled = () => {
    if (isProcessing) return true;
    if (!userAddress) return true;

    // Check if user is already in either team
    if (
      match.teamA.includes(userAddress as `0x${string}`) ||
      match.teamB.includes(userAddress as `0x${string}`)
    ) {
      return true;
    }

    const spots = getTeamSpots();
    if (spots.teamA === 0 && spots.teamB === 0) return true;

    return false;
  };

  const isConfirmDisabled = () => {
    if (isProcessing) return true;
    if (!userAddress) return true;

    // For 2v2 and 5v5, require team selection
    if (match.matchType !== "ONE_V_ONE" && !selectedTeam) return true;

    const spots = getTeamSpots();
    // If team is selected, check if it has spots
    if (selectedTeam === "A" && spots.teamA === 0) return true;
    if (selectedTeam === "B" && spots.teamB === 0) return true;

    return false;
  };

  const handleJoin = async () => {
    // For 1v1, team selection doesn't matter
    if (match.matchType === "ONE_V_ONE") {
      await onJoin(true);
      return;
    }

    // For 2v2 and 5v5, require team selection
    if (!selectedTeam) {
      return;
    }

    await onJoin(selectedTeam === "A");
  };

  const getTeamMembers = (team: `0x${string}`[]) => {
    const required = getRequiredPlayers();
    return (
      <div className="space-y-1">
        {team.map((address, index) => (
          <p key={address} className="text-sm">
            Player {index + 1}: {truncateAddress(address)}
          </p>
        ))}
        {team.length < required && (
          <p className="text-sm text-muted-foreground">
            {required - team.length} spot{required - team.length > 1 ? "s" : ""}{" "}
            available
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={isJoinButtonDisabled()}>
          {getJoinButtonText()}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Join {match.matchType} Match #{match.id.toString()}
          </DialogTitle>
          <DialogDescription>
            {match.matchType === "ONE_V_ONE"
              ? `You are about to join this match with ${formatEther(
                  match.player1Amount
                )} ETH.`
              : `Select a team to join with ${formatEther(
                  match.player1Amount
                )} ETH stake.`}
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">Match Details:</p>
            <div className="mt-2 space-y-3">
              {match.matchType !== "ONE_V_ONE" && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Button
                    variant={selectedTeam === "A" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSelectedTeam("A")}
                    disabled={getTeamSpots().teamA === 0}
                  >
                    Team A ({getTeamSpots().teamA} spots)
                  </Button>
                  <Button
                    variant={selectedTeam === "B" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSelectedTeam("B")}
                    disabled={getTeamSpots().teamB === 0}
                  >
                    Team B ({getTeamSpots().teamB} spots)
                  </Button>
                </div>
              )}
              <div>
                <p className="font-medium text-sm">Team A</p>
                {getTeamMembers(match.teamA)}
              </div>
              <div>
                <p className="font-medium text-sm">Team B</p>
                {getTeamMembers(match.teamB)}
              </div>
              <p className="text-sm">
                Stake Amount: {formatEther(match.player1Amount)} ETH
              </p>
              <p className="text-sm">
                Total Prize Pool: {formatEther(match.totalAmount)} ETH
              </p>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={isConfirmDisabled()}
            onClick={handleJoin}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : selectedTeam ? (
              `Join Team ${selectedTeam}`
            ) : (
              "Select a Team"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
