import { formatEther } from "viem";

interface MatchPlayerInfoProps {
  addresses: `0x${string}`[];
  stake: bigint;
  label: string;
  maxPlayers: number;
  convertToUsd: (ethAmount: bigint) => number;
  isERC20?: boolean;
}

export function MatchPlayerInfo({
  addresses,
  stake,
  label,
  maxPlayers,
  convertToUsd,
  isERC20 = false,
}: MatchPlayerInfoProps) {
  const truncateAddress = (address: string | null | undefined) => {
    if (!address) return "N/A";
    if (address === "0x0000000000000000000000000000000000000000") return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Create an array of player slots based on maxPlayers
  const playerSlots = Array.from({ length: maxPlayers }, (_, index) => {
    const address = addresses[index];
    return (
      <p key={index} className="text-sm">
        Player {index + 1}: {truncateAddress(address)}
      </p>
    );
  });

  return (
    <div>
      <h3 className="font-medium mb-2">{label}</h3>
      <div className="space-y-1">{playerSlots}</div>
      <p className="text-sm text-muted-foreground mt-2">
        Stake per player: {formatEther(stake)} {isERC20 ? "MATCH" : "ETH"}
        {!isERC20 && (
          <span className="ml-1">(≈${convertToUsd(stake).toFixed(2)})</span>
        )}
        {isERC20 && (
          <span className="ml-1">(No USD value)</span>
        )}
      </p>
    </div>
  );
}
