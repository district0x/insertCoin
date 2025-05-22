// components/TournamentJoinModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { useTournamentJoin } from '@/hooks/useTournamentJoin';
import { ethers } from 'ethers';

interface TournamentJoinModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentDetails: {
        tournamentId: string;
        entryFee: string;
        maxParticipants: number;
        currentParticipants: number;
        totalPrize: number;
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

    const address = useAddress();
    const connectionStatus = useConnectionStatus();

    // Format entry fee and total prize for display
    const formattedEntryFee = typeof tournamentDetails.entryFee === 'string' && tournamentDetails.entryFee.includes('.')
        ? tournamentDetails.entryFee // Already formatted
        : ethers.utils.formatEther(tournamentDetails.entryFee.toString() || '0'); // Format from Wei
    const formattedTotalPrize = tournamentDetails.totalPrize.toFixed(4);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    // Start join process when the modal opens
    useEffect(() => {
        if (isOpen && step === 'initial') {
            startJoinProcess();
        }
    }, [isOpen, step, startJoinProcess]);

    // Close modal and notify parent of success
    const handleSuccess = () => {
        onJoinSuccess();
        onClose();
    };

    // Handle joining the tournament
    const handleJoin = async () => {
        const success = await joinTournamentGame(tournamentDetails, playerName);
        if (success) {
            handleSuccess();
        }
    };

    // Handle authentication
    const handleAuthenticate = async () => {
        await authenticate();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-semibold mb-4">Join Tournament</h2>

                <div className="mb-6 space-y-3">
                    <div className="flex justify-between">
                        <span className="font-medium">Entry Fee:</span>
                        <span>{formattedEntryFee} ETH</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Total Prize Pool:</span>
                        <span>{formattedTotalPrize} ETH</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Players:</span>
                        <span>{tournamentDetails.currentParticipants} / {tournamentDetails.maxParticipants}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Status:</span>
                        <span className="capitalize">{tournamentDetails.status.toLowerCase()}</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {step === 'connecting' && connectionStatus !== "connected" && (
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

                    {step === 'joining' && (
                        <button
                            className={`w-full py-2 px-4 rounded font-medium ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                            onClick={handleJoin}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Joining Tournament...' : `Join Tournament (${formattedEntryFee} ETH)`}
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