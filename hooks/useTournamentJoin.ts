import { ethers } from "ethers";
import { useState, useCallback } from 'react';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { useTournamentContract } from './useTournamentContract';
import { useAuth } from './useAuth';
import { useRouter } from 'next/navigation';
import { formatTournamentError } from '@/lib/tournamentDiagnostics';


interface TournamentDetails {
    tournamentId: string;
    entryFee: string;
    maxParticipants: number;
    currentParticipants: number;
    totalPrize: number;
    roomCode: string;
    status: string;
}

export function useTournamentJoin() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'initial' | 'connecting' | 'authenticating' | 'joining' | 'complete'>('initial');

    const router = useRouter();
    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const { isAuthenticated, signIn } = useAuth();
    const { joinTournament, isEntrantInTournament } = useTournamentContract();

    // Reset the joining state
    const resetState = useCallback(() => {
        setIsLoading(false);
        setError(null);
        setStep('initial');
    }, []);

    // Start the joining process
    const startJoinProcess = useCallback(() => {
        setError(null);

        // Determine the starting step based on the current state
        if (connectionStatus !== 'connected') {
            setStep('connecting');
        } else if (!isAuthenticated) {
            setStep('authenticating');
        } else {
            setStep('joining');
        }
    }, [connectionStatus, isAuthenticated]);

    // Authenticate with Ethereum signature
    const authenticate = useCallback(async () => {
        if (connectionStatus !== 'connected') {
            setError('Please connect your wallet first');
            setStep('connecting');
            return false;
        }

        try {
            setIsLoading(true);
            const success = await signIn();

            if (success) {
                setStep('joining');
                return true;
            } else {
                setError('Authentication failed');
                return false;
            }
        } catch (err: any) {
            setError(formatTournamentError(err));
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [connectionStatus, signIn]);

    // Join a tournament
    const joinTournamentGame = useCallback(async (
        tournament: TournamentDetails,
        playerName: string
    ) => {
        if (!address || !isAuthenticated) {
            setError('Please connect your wallet and authenticate first');
            return false;
        }

        try {
            setIsLoading(true);
            setError(null);

            // First check if already joined
            const isParticipant = await isEntrantInTournament(
                parseInt(tournament.tournamentId),
                address
            );

            if (isParticipant) {
                // Already joined, no need to pay again
                setStep('complete');

                // Navigate to game room
                router.push(
                    `/game/${tournament.roomCode}?name=${encodeURIComponent(playerName)}&role=player&tournamentId=${tournament.tournamentId}&walletAddress=${address}`
                );

                return true;
            }

            // Join the tournament by paying the entry fee
            // Format the entry fee properly for the transaction
            console.log("Processing entry fee:", {
                fee: tournament.entryFee,
                type: typeof tournament.entryFee,
                isString: typeof tournament.entryFee === 'string',
                hasDecimal: typeof tournament.entryFee === 'string' && tournament.entryFee.includes('.')
            });

            let entryFeeForJoin;
            try {
                // First ensure we're working with a string
                const entryFeeStr = tournament.entryFee.toString();

                // Handle different formats
                if (entryFeeStr.includes('.')) {
                    // It's in ETH format (e.g. "0.01"), convert to Wei
                    entryFeeForJoin = ethers.utils.parseEther(entryFeeStr).toString();
                    console.log("Converted ETH to Wei:", entryFeeForJoin);
                } else if (entryFeeStr.length > 10) {
                    // It's likely already in Wei format
                    entryFeeForJoin = entryFeeStr;
                    console.log("Using existing Wei value:", entryFeeForJoin);
                } else {
                    // For smaller numbers without decimal, determine if it's ETH or Wei
                    const value = parseFloat(entryFeeStr);
                    if (value < 1) {
                        // Small value like 0.01 - treat as ETH
                        entryFeeForJoin = ethers.utils.parseEther(entryFeeStr).toString();
                        console.log("Converted small number to Wei:", entryFeeForJoin);
                    } else {
                        // Larger value - treat as Wei
                        entryFeeForJoin = entryFeeStr;
                        console.log("Using number as Wei:", entryFeeForJoin);
                    }
                }
            } catch (err) {
                console.error("Error formatting entry fee:", err);

                // Fallback - try direct conversion or use a default
                try {
                    entryFeeForJoin = tournament.entryFee.toString();
                } catch (fallbackErr) {
                    console.error("Fallback also failed:", fallbackErr);
                    entryFeeForJoin = "10000000000000000"; // Default to 0.01 ETH in Wei
                }
            }

            // Log the final value we're using
            console.log("Final entry fee for join:", entryFeeForJoin);

            // Join the tournament by paying the entry fee
            const joinResult = await joinTournament(
                parseInt(tournament.tournamentId),
                entryFeeForJoin
            );

            // Update participant in database
            await fetch(`/api/tournament/${tournament.roomCode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'join',
                    walletAddress: address
                })
            });

            setStep('complete');

            // Navigate to game room
            router.push(
                `/game/${tournament.roomCode}?name=${encodeURIComponent(playerName)}&role=player&tournamentId=${tournament.tournamentId}&walletAddress=${address}`
            );

            return true;
        } catch (err: any) {
            console.error('Error joining tournament:', err);
            setError(formatTournamentError(err));
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [address, isAuthenticated, isEntrantInTournament, joinTournament, router]);

    // Check if already a participant
    const checkParticipantStatus = useCallback(async (tournamentId: string) => {
        if (!address) return false;

        try {
            return await isEntrantInTournament(
                parseInt(tournamentId),
                address
            );
        } catch (err) {
            console.error('Error checking participant status:', err);
            return false;
        }
    }, [address, isEntrantInTournament]);

    return {
        isLoading,
        error,
        step,
        resetState,
        startJoinProcess,
        authenticate,
        joinTournamentGame,
        checkParticipantStatus
    };
}