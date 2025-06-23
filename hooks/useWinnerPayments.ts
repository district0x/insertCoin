import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useTournamentContract } from './useTournamentContract';

export interface WinnerPayment {
    tournamentId: string;
    matchId?: string;
    winnerAddress: string;
    winnerName?: string;
    amount: string;
    amountFormatted: string;
    tokenSymbol: string;
    tokenAddress: string;
    isERC20: boolean;
    timestamp: string;
    transactionHash: string;
    blockNumber: number;
    gameType: 'tournament' | 'match' | '2v2match';
    participants: Array<{
        name: string;
        address: string;
        score?: number;
    }>;
    totalPrizePool: string;
    totalPrizePoolFormatted: string;
}

export interface RecentGameResult {
    tournamentId: string;
    matchId?: string;
    roomCode: string;
    gameType: 'tournament' | 'match' | '2v2match';
    status: 'completed' | 'cancelled';
    participants: Array<{
        name: string;
        address: string;
        score?: number;
        isWinner: boolean;
        prizeAmount?: string;
        prizeAmountFormatted?: string;
    }>;
    totalPrizePool: string;
    totalPrizePoolFormatted: string;
    entryFee: string;
    entryFeeFormatted: string;
    tokenSymbol: string;
    tokenAddress: string;
    isERC20: boolean;
    completedAt: string;
    winners: Array<{
        address: string;
        name: string;
        amount: string;
        amountFormatted: string;
        percentage: number;
    }>;
}

export function useWinnerPayments() {
    const [recentPayments, setRecentPayments] = useState<WinnerPayment[]>([]);
    const [recentGames, setRecentGames] = useState<RecentGameResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getTournamentDetails, getTournamentWinnerData } = useTournamentContract();

    // Fetch recent winner payments from blockchain events
    const fetchRecentPayments = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Fetch from your API endpoint that listens to blockchain events
            const response = await fetch('/api/winner-payments?limit=10');
            if (response.ok) {
                const data = await response.json();
                setRecentPayments(data.payments || []);
            } else {
                throw new Error('Failed to fetch recent payments');
            }
        } catch (err: any) {
            console.error('Error fetching recent payments:', err);
            setError(err.message || 'Failed to fetch recent payments');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch recent game results
    const fetchRecentGames = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/recent-games?limit=5');
            if (response.ok) {
                const data = await response.json();
                setRecentGames(data.games || []);
            } else {
                throw new Error('Failed to fetch recent games');
            }
        } catch (err: any) {
            console.error('Error fetching recent games:', err);
            setError(err.message || 'Failed to fetch recent games');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Get winner payment details for a specific tournament
    const getWinnerPaymentDetails = useCallback(async (tournamentId: string, winnerAddress: string) => {
        try {
            const winnerData = await getTournamentWinnerData(parseInt(tournamentId), winnerAddress);
            return winnerData;
        } catch (err) {
            console.error('Error fetching winner payment details:', err);
            return null;
        }
    }, [getTournamentWinnerData]);

    // Format amount based on token type
    const formatAmount = useCallback((amount: string, tokenSymbol: string, isERC20: boolean) => {
        if (isERC20) {
            return `${amount} ${tokenSymbol}`;
        } else {
            const ethAmount = ethers.utils.formatEther(amount);
            return `${ethAmount} ${tokenSymbol}`;
        }
    }, []);

    // Refresh all data
    const refreshData = useCallback(async () => {
        await Promise.all([
            fetchRecentPayments(),
            fetchRecentGames()
        ]);
    }, [fetchRecentPayments, fetchRecentGames]);

    // Initialize data on mount
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    return {
        recentPayments,
        recentGames,
        isLoading,
        error,
        fetchRecentPayments,
        fetchRecentGames,
        getWinnerPaymentDetails,
        refreshData,
        formatAmount
    };
} 