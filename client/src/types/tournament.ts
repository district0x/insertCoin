export type TournamentStatus =
    | "CREATED"
    | "FILLING"
    | "FILLED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";

export interface OnChainTournament {
    id: bigint;
    winnersPercentage: number;
    multisigPercentage: number;
    isActive: boolean;
    hasStarted: boolean;
    isERC20: boolean;
    hasEntryFee: boolean;
    numEntrants: bigint;
    totalDonations: bigint;
    totalTokenDonations: bigint;
    remainingBalance: bigint;
    entryFee: bigint;
    token: `0x${string}`;
    currentEntrants: number;
    status: TournamentStatus;
} 