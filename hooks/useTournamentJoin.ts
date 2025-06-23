import { ethers } from "ethers";
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTournamentContract } from './useTournamentContract';
import { usePrivy } from '@privy-io/react-auth';
import { formatTournamentError } from '@/lib/tournamentDiagnostics';


interface TournamentDetails {
    tournamentId: string;
    entryFee: string;
    tokenAddress: string; // Needed for ERC20 approval flow
    maxParticipants: number;
    currentParticipants: number;
    totalPrize: string;
    roomCode: string;
    status: string;
}

export function useTournamentJoin() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'initial' | 'connecting' | 'authenticating' | 'approving' | 'approved' | 'joining' | 'complete'>('initial');

    const router = useRouter();
    const { authenticated: isAuthenticated, user, login } = usePrivy();
    const { joinTournament, isEntrantInTournament, checkAllowance, approveTokenSpend } = useTournamentContract();
    console.log('Privy:', { isAuthenticated, user });

    // Reset the joining state
    const resetState = useCallback(() => {
        setIsLoading(false);
        setError(null);
        setStep('initial');
    }, []);

    // Start the joining process
    const startJoinProcess = useCallback(() => {
        console.log('[DEBUG] startJoinProcess called, isAuthenticated:', isAuthenticated);
        setError(null);
        if (!isAuthenticated) {
            console.log('[DEBUG] User not authenticated, setting step to authenticating');
            setStep('authenticating');
        } else {
            console.log('[DEBUG] User authenticated, setting step to joining');
            setStep('joining');
        }
    }, [isAuthenticated]);

    // Authenticate with Privy
    const authenticate = useCallback(async () => {
        console.log('[DEBUG] authenticate called, isAuthenticated:', isAuthenticated);
        if (!isAuthenticated) {
            console.log('[DEBUG] Starting authentication process');
            setStep('authenticating');
            await login();
            return false;
        }
        console.log('[DEBUG] User already authenticated, setting step to joining');
        setStep('joining');
        return true;
    }, [isAuthenticated, login]);

    // Join a tournament
    const joinTournamentGame = useCallback(async (
        tournament: TournamentDetails,
        playerName: string
    ) => {
        if (!user?.wallet?.address || !isAuthenticated) {
            setError('Please connect your wallet and authenticate first');
            return false;
        }
        const address = user.wallet.address;
        const contractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS;
        const isErc20 = tournament.tokenAddress && tournament.tokenAddress !== '0x0000000000000000000000000000000000000000';

        if (!contractAddress) {
            setError('Tournament contract address is not configured.');
            return false;
        }

        try {
            setIsLoading(true);
            setError(null);

            console.log('[DEBUG] Starting join process:', {
                tournamentId: tournament.tournamentId,
                address,
                isAuthenticated,
                user: user?.wallet,
                roomCode: tournament.roomCode,
                tournamentKeys: Object.keys(tournament)
            });

            // First check if already joined
            console.log('[DEBUG] Checking participant status for tournamentId:', tournament.tournamentId, 'address:', address);
            const isParticipant = await isEntrantInTournament(
                parseInt(tournament.tournamentId),
                address
            );
            console.log('[DEBUG] isEntrantInTournament result:', isParticipant);

            if (isParticipant) {
                console.log('[DEBUG] User is already a participant, proceeding to game');
                setStep('complete');
                router.push(
                    `/game/${tournament.roomCode}?name=${encodeURIComponent(playerName)}&role=player&tournamentId=${tournament.tournamentId}&walletAddress=${address}`
                );
                return true;
            }

            // --- ERC20 Approval Flow ---
            if (isErc20) {
                setStep('approving');
                const entryFeeBigNum = ethers.BigNumber.from(tournament.entryFee);

                // 1. Check allowance
                const currentAllowance = await checkAllowance(tournament.tokenAddress, address, contractAddress);

                // 2. If allowance is insufficient, request approval
                if (currentAllowance.lt(entryFeeBigNum)) {
                    const approveTx = await approveTokenSpend(tournament.tokenAddress, entryFeeBigNum);
                    await approveTx.wait(); // Wait for the approval transaction to be mined
                }
                setStep('approved');
            }
            // --- End of Approval Flow ---

            setStep('joining');
            console.log('[DEBUG] Calling on-chain joinTournament with entryFee:', tournament.entryFee);
            await joinTournament(
                parseInt(tournament.tournamentId),
                tournament.entryFee as string,
                isErc20 as boolean
            );

            // Update participant in database
            console.log('[DEBUG] Adding participant to database:', {
                roomCode: tournament.roomCode,
                walletAddress: address,
                name: playerName,
                tournamentId: tournament.tournamentId,
                tournamentIdType: typeof tournament.tournamentId
            });

            // Check if room code is valid
            if (!tournament.roomCode || tournament.roomCode === 'undefined') {
                console.error('[DEBUG] Invalid room code detected:', tournament.roomCode);
                throw new Error(`Invalid room code: ${tournament.roomCode}`);
            }

            console.log('[DEBUG] Making database call to room code:', tournament.roomCode);
            const dbResponse = await fetch(`/api/tournament/${tournament.roomCode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'join',
                    walletAddress: address,
                    name: playerName
                })
            });

            console.log('[DEBUG] Database response status:', dbResponse.status);
            console.log('[DEBUG] Database response headers:', Object.fromEntries(dbResponse.headers.entries()));

            if (!dbResponse.ok) {
                const errorData = await dbResponse.json();
                console.error('[DEBUG] Database error response:', errorData);
                throw new Error(`Database error: ${errorData.error || 'Unknown error'}`);
            }

            const dbResult = await dbResponse.json();
            console.log('[DEBUG] Database join result:', dbResult);

            setStep('complete');
            router.push(
                `/game/${tournament.roomCode}?name=${encodeURIComponent(playerName)}&role=player&tournamentId=${tournament.tournamentId}&walletAddress=${address}`
            );
            return true;
        } catch (err: any) {
            console.error('[DEBUG] Error joining tournament:', {
                message: err.message,
                code: err.code,
                reason: err.reason,
                error: err.error,
                data: err.data,
                transaction: err.transaction,
                receipt: err.receipt,
                stack: err.stack,
                fullError: err
            });

            // Set a more descriptive error message
            let errorMessage = "Failed to join tournament";
            if (err.message) {
                errorMessage = err.message;
            } else if (err.reason) {
                errorMessage = err.reason;
            } else if (err.error?.message) {
                errorMessage = err.error.message;
            }

            setError(errorMessage);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [user, isAuthenticated, router, joinTournament, isEntrantInTournament, checkAllowance, approveTokenSpend]);

    // Check if already a participant
    const checkParticipantStatus = useCallback(async (tournamentId: string) => {
        if (!user?.wallet?.address) return false;
        try {
            return await isEntrantInTournament(
                parseInt(tournamentId),
                user.wallet.address
            );
        } catch (err) {
            console.error('Error checking participant status:', err);
            return false;
        }
    }, [user, isEntrantInTournament]);

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