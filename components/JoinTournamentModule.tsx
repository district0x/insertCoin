// components/TournamentJoinModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTournamentJoin } from '@/hooks/useTournamentJoin';
import { ethers } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';

interface TournamentJoinModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentDetails: {
        tournamentId: string;
        entryFee: string; // Keep as raw value for the transaction
        entryFeeFormatted: string; // For display
        tokenAddress: string; // Crucial for approval flow
        tokenSymbol: string; // For display
        tokenDecimals: number; // To format the prize pool
        maxParticipants: number;
        currentParticipants: number;
        totalPrize: string; // Now a raw string value
        status: string;
        roomCode: string;
    };
    playerName: string;
    onJoinSuccess: () => void;
}

export function TournamentJoinModal({
    isOpen,
    onClose,
    tournamentDetails,
    playerName,
    onJoinSuccess
}: TournamentJoinModalProps) {
    const {
        isLoading,
        error,
        step,
        resetState,
        startJoinProcess,
        authenticate,
        joinTournamentGame
    } = useTournamentJoin();

    const { authenticated: isAuthenticated, user, login } = usePrivy();
    console.log('[DEBUG] TournamentJoinModal - Privy state:', { isAuthenticated, user });

    // Use the formatted values passed in from props
    const {
        entryFeeFormatted,
        tokenSymbol,
        totalPrize,
        status,
        currentParticipants,
        maxParticipants,
        tokenDecimals
    } = tournamentDetails;

    // Format the prize pool using the correct decimals
    const formattedTotalPrize = ethers.utils.formatUnits(totalPrize.toString() || '0', tokenDecimals);

    // Reset state when modal opens
    useEffect(() => {
        console.log('[DEBUG] TournamentJoinModal - Modal opened, resetting state');
        if (isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    // Start join process when the modal opens
    useEffect(() => {
        console.log('[DEBUG] TournamentJoinModal - Starting join process, step:', step);
        if (isOpen && step === 'initial') {
            startJoinProcess();
        }
    }, [isOpen, step, startJoinProcess]);

    // Close modal and notify parent of success
    const handleSuccess = () => {
        console.log('[DEBUG] TournamentJoinModal - Join successful, calling onJoinSuccess');
        onJoinSuccess();
        onClose();
    };

    // Handle joining the tournament
    const handleJoin = async () => {
        console.log('[DEBUG] TournamentJoinModal - handleJoin called');
        if (!isAuthenticated) {
            console.log('[DEBUG] TournamentJoinModal - User not authenticated, prompting login');
            alert('Please sign in with your wallet to join a tournament');
            await login();
            return;
        }
        if (!user?.wallet?.address) {
            console.log('[DEBUG] TournamentJoinModal - No wallet address available');
            alert('Please connect your wallet to join a tournament');
            return;
        }
        console.log('[DEBUG] Calling joinTournamentGame with:', tournamentDetails);
        const success = await joinTournamentGame(
            tournamentDetails, // This object contains the required `tokenAddress`
            playerName
        );
        console.log('[DEBUG] TournamentJoinModal - joinTournamentGame result:', success);
        if (success) {
            handleSuccess();
        }
    };

    // Handle authentication
    const handleAuthenticate = async () => {
        console.log('[DEBUG] TournamentJoinModal - handleAuthenticate called');
        await login();
    };

    if (!isOpen) return null;

    console.log('[DEBUG] TournamentJoinModal - Rendering modal with step:', step);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-semibold mb-4">Join Tournament</h2>

                <div className="mb-6 space-y-3">
                    <div className="flex justify-between">
                        <span className="font-medium">Entry Fee:</span>
                        <span>{entryFeeFormatted} {tokenSymbol}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Total Prize Pool:</span>
                        <span>{formattedTotalPrize} {tokenSymbol}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Players:</span>
                        <span>{currentParticipants} / {maxParticipants}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Status:</span>
                        <span className="capitalize">{status.toLowerCase()}</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {step === 'connecting' && (
                        <div className="text-center">
                            <p className="mb-2">Please connect your wallet to continue</p>
                            <p className="text-sm text-gray-500">If a wallet connection dialog doesn't appear, please check your wallet extension</p>
                        </div>
                    )}

                    {step === 'authenticating' && (
                        <button
                            className="w-full py-2 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                            onClick={handleAuthenticate}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing...' : 'Sign in with Ethereum'}
                        </button>
                    )}

                    {step === 'approving' && (
                        <div className="text-center p-2 bg-blue-50 text-blue-700 rounded-md">
                            <div className="font-bold">Permission Required</div>
                            <p className="text-sm">Please approve the transaction in your wallet to allow the contract to use your {tournamentDetails.tokenSymbol}.</p>
                        </div>
                    )}

                    {step === 'approved' && (
                        <div className="text-center p-2 bg-green-50 text-green-700 rounded-md">
                            <div className="font-bold">Approval Successful!</div>
                            <p className="text-sm">You can now join the tournament.</p>
                        </div>
                    )}

                    {step === 'joining' && (
                        <button
                            className={`w-full py-2 px-4 rounded font-medium ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                            onClick={handleJoin}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Joining Tournament...' : `Join Tournament (${entryFeeFormatted} ${tokenSymbol})`}
                        </button>
                    )}

                    {step === 'complete' && (
                        <div className="text-center text-green-600 font-medium">
                            You have successfully joined the tournament!
                        </div>
                    )}

                    <button
                        className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300 mt-2"
                        onClick={onClose}
                    >
                        {step === 'complete' ? 'Enter Game' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
}