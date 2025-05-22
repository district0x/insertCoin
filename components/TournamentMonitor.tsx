// components/EnhancedTournamentMonitor.tsx - A comprehensive tournament monitoring component
'use client';

import { useState, useEffect } from 'react';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { ethers } from 'ethers';
import Link from 'next/link';

interface EnhancedTournamentMonitorProps {
    tournamentId: string;
    roomCode?: string;
    className?: string;
}

export function EnhancedTournamentMonitor({
    tournamentId,
    roomCode,
    className = ''
}: EnhancedTournamentMonitorProps) {
    const [onChainDetails, setOnChainDetails] = useState<any>(null);
    const [offChainDetails, setOffChainDetails] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isLoadingOnChain, setIsLoadingOnChain] = useState(true);
    const [isLoadingOffChain, setIsLoadingOffChain] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [matchingPoolAmount, setMatchingPoolAmount] = useState<string>('0');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { getTournamentDetails, getMatchingPoolBalance } = useTournamentContract();
    const address = useAddress();
    const connectionStatus = useConnectionStatus();

    // Fetch tournament data from both on-chain and off-chain sources
    const fetchTournamentData = async () => {
        if (!tournamentId) return;

        setIsRefreshing(true);
        setError(null);

        try {
            // Parallel fetching to improve performance
            await Promise.all([
                fetchOnChainData(),
                fetchOffChainData()
            ]);
        } catch (err: any) {
            console.error("Error in tournament data fetching:", err);
            setError("Failed to load complete tournament data. Please try again.");
        } finally {
            setIsRefreshing(false);
        }
    };

    // Fetch data from the blockchain
    const fetchOnChainData = async () => {
        try {
            setIsLoadingOnChain(true);

            // Only attempt blockchain calls if wallet is connected
            if (connectionStatus === "connected") {
                // Get tournament details from blockchain
                const details = await getTournamentDetails(parseInt(tournamentId));
                setOnChainDetails(details);

                // Get matching pool balance
                const matchingPool = await getMatchingPoolBalance();
                setMatchingPoolAmount(ethers.utils.formatEther(matchingPool));
            } else {
                console.log("Wallet not connected, skipping on-chain data fetching");
            }
        } catch (err: any) {
            console.error("Error fetching on-chain data:", err);
            // Don't set the error here to avoid blocking the UI if only one source fails
        } finally {
            setIsLoadingOnChain(false);
        }
    };

    // Fetch data from Supabase via API
    const fetchOffChainData = async () => {
        try {
            setIsLoadingOffChain(true);

            // Fetch tournament details from our database
            const response = await fetch(`/api/tournament/byid/${tournamentId}`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.tournament) {
                setOffChainDetails(data.tournament);
            }

            // Fetch participants (in a separate try block to avoid blocking if this fails)
            try {
                const participantsRes = await fetch(`/api/tournament/byid/${tournamentId}/participants`);
                if (participantsRes.ok) {
                    const participantsData = await participantsRes.json();
                    setParticipants(participantsData.participants || []);
                }
            } catch (participantsErr) {
                console.warn("Error fetching participants:", participantsErr);
            }
        } catch (err: any) {
            console.error("Error fetching off-chain data:", err);
            // Don't set the error here to avoid blocking the UI if only one source fails
        } finally {
            setIsLoadingOffChain(false);
        }
    };

    // Load data on component mount
    useEffect(() => {
        fetchTournamentData();
    }, [tournamentId, connectionStatus]);

    // Format ETH amounts for display
    const formatEth = (amount: string) => {
        return parseFloat(amount).toFixed(4) + ' ETH';
    };

    if (isLoadingOnChain && isLoadingOffChain) {
        return (
            <div className={`bg-white p-4 rounded-lg shadow ${className}`}>
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Merge data from both sources for a complete view
    const mergedData = {
        // Default values
        tournamentId,
        roomCode: roomCode || offChainDetails?.roomCode || 'Unknown',
        status: offChainDetails?.status || (onChainDetails?.isActive ? 'ACTIVE' : 'INACTIVE'),
        hasStarted: onChainDetails?.hasStarted || false,
        entryFee: onChainDetails?.entryFee || offChainDetails?.entryFee || '0',
        maxParticipants: onChainDetails?.numEntrants || offChainDetails?.maxParticipants || 0,
        currentParticipants: onChainDetails?.currentEntrants || offChainDetails?.currentParticipants || participants.length || 0,
        remainingBalance: onChainDetails?.remainingBalance || '0',
        winnersPercentage: onChainDetails?.winnersPercentage || 80,
        multisigPercentage: onChainDetails?.multisigPercentage || 10,
        // Add more properties as needed
    };

    const totalPrizePool = parseFloat(mergedData.entryFee) * parseInt(mergedData.maxParticipants.toString());

    return (
        <div className={`bg-white p-5 rounded-lg shadow-md ${className}`}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-blue-700">Tournament #{tournamentId}</h2>
                <button
                    onClick={fetchTournamentData}
                    disabled={isRefreshing}
                    className="px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-600 text-sm disabled:opacity-50"
                >
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Status badge */}
            <div className="mb-4 flex items-center gap-2">
                <span className={`px-3 py-1 text-sm rounded-full ${!mergedData.hasStarted && mergedData.status !== 'COMPLETED'
                        ? 'bg-yellow-100 text-yellow-800'
                        : mergedData.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : mergedData.hasStarted
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                    }`}>
                    {mergedData.status === 'COMPLETED'
                        ? 'Completed'
                        : !mergedData.hasStarted
                            ? 'Created (Not Started)'
                            : 'In Progress'}
                </span>

                {roomCode && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                        Room: {roomCode}
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Tournament Details</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Entry Fee:</span>
                            <span className="font-medium">{formatEth(mergedData.entryFee)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Players:</span>
                            <span className="font-medium">{mergedData.currentParticipants} / {mergedData.maxParticipants}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Winners Split:</span>
                            <span className="font-medium">{mergedData.winnersPercentage}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Platform Fee:</span>
                            <span className="font-medium">{mergedData.multisigPercentage}%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-700 mb-2">Financial Summary</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-blue-600">Total Prize Pool:</span>
                            <span className="font-medium">{totalPrizePool.toFixed(4)} ETH</span>
                        </div>
                        {onChainDetails?.remainingBalance && (
                            <div className="flex justify-between">
                                <span className="text-blue-600">Balance:</span>
                                <span className="font-medium">{ethers.utils.formatEther(onChainDetails.remainingBalance || '0')} ETH</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-blue-600">Matching Pool:</span>
                            <span className="font-medium">{formatEth(matchingPoolAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-blue-600">Winners Pot:</span>
                            <span className="font-medium">{(totalPrizePool * mergedData.winnersPercentage / 100).toFixed(4)} ETH</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Participant list */}
            {participants.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Participants ({participants.length})</h3>
                    <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-2">
                        <div className="space-y-1">
                            {participants.map((participant, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                    <span className="text-gray-700 truncate" title={participant.walletAddress}>
                                        {participant.walletAddress.substring(0, 6)}...{participant.walletAddress.substring(participant.walletAddress.length - 4)}
                                    </span>
                                    <span className="text-gray-500 text-xs">
                                        {new Date(participant.joinedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
                {roomCode && (
                    <Link href={`/game/${roomCode}?tournamentId=${tournamentId}`} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                        Join Game Room
                    </Link>
                )}

                <Link href={`/admin?tournamentId=${tournamentId}`} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">
                    Manage Tournament
                </Link>

                {connectionStatus !== "connected" && (
                    <div className="mt-2 w-full text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                        Connect your wallet to see on-chain tournament details
                    </div>
                )}
            </div>
        </div>
    );
}