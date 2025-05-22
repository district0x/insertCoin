// FILE: /app/types/tournament.ts
export type TournamentStatus =
    | "CREATED"
    | "FILLING"
    | "FILLED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";

export interface OnChainTournament {
    id: string;
    numEntrants: string;
    currentEntrants: string;
    winnersPercentage: number;
    multisigPercentage: number;
    entryFee: string;
    isActive: boolean;
    hasStarted: boolean;
    isERC20: boolean;
    token: string;
    status?: TournamentStatus;
}

export interface TournamentPlayer {
    id: string;
    address: string;
    name: string;
    score: number;
    eliminated: boolean;
    walletAddress?: string;
}

export interface TournamentWinner {
    address: string;
    percentage: number;
}