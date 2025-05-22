'use client';

import { useState, useEffect } from 'react';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { useAddress } from '@thirdweb-dev/react';
import { ethers } from 'ethers';

interface TournamentInfoProps {
    tournamentId: string;
    isHost: boolean;
    winners: Array<{
        name: string;
        address: string;
        score: number;
    }>;
}

export function TournamentInfo({ tournamentId, isHost, winners = [] }: TournamentInfoProps) {
    const [tournamentDetails, setTournamentDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEndingTournament, setIsEndingTournament] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isParticipant, setIsParticipant] = useState(false);
    const [winnerDistribution, setWinnerDistribution] = useState<Array<{ percentage: number; address: string; name: string; share: string }>>([]);

    const { getTournamentDetails, isEntrantInTournament, endTournament, isAdmin } = useTournamentContract();
    const address = useAddress();

    useEffect(() => {
        const fetchTournamentDetails = async () => {
            if (!tournamentId) return;

            try {
                setIsLoading(true);
                setError(null);

                // Fetch on-chain tournament details
                const details = await getTournamentDetails(parseInt(tournamentId));
                setTournamentDetails(details);

                // Check if current user is a participant
                if (address) {
                    const participantCheck = await isEntrantInTournament(parseInt(tournamentId), address);
                    setIsParticipant(participantCheck);
                }

                // Also fetch off-chain tournament data from Supabase using the new byid route
                const response = await fetch(`/api/tournament/byid/${tournamentId}/results`);
                const data = await response.json();

                if (data.tournament) {
                    // Merge the additional details
                    setTournamentDetails(prev => ({
                        ...prev,
                        ...data.tournament,
                        // Convert any Supabase values if needed
                    }));
                }

            } catch (err: any) {
                console.error('Error fetching tournament details:', err);
                setError(err.message || 'Failed to load tournament details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTournamentDetails();
    }, [tournamentId, address, getTournamentDetails, isEntrantInTournament]);

    // Calculate winner distribution when winners array changes
    useEffect(() => {
        if (winners.length === 0 || !tournamentDetails) return;

        // Calculate total score
        const totalScore = winners.reduce((sum, w) => sum + w.score, 0);

        // Calculate distribution based on scores
        const prizePool = parseFloat(ethers.utils.formatEther(tournamentDetails.remainingBalance || '0'));
        const winnerPoolPercentage = tournamentDetails.winnersPercentage || 80;
        const winnerPool = prizePool * (winnerPoolPercentage / 100);

        const distribution = winners.map(winner => {
            // Calculate percentage based on score (min 1%)
            const percentage = Math.max(1, Math.round((winner.score / totalScore) * 100));
            // Calculate ETH share
            const share = (percentage / 100 * winnerPool).toFixed(4);

            return {
                name: winner.name,
                address: winner.address,
                percentage,
                share
            };
        });

        // Ensure percentages sum to 100% by adjusting top scorer if needed
        let sum = distribution.reduce((total, item) => total + item.percentage, 0);
        if (sum !== 100 && distribution.length > 0) {
            // Adjust the top scorer's percentage
            distribution[0].percentage += (100 - sum);
            // Recalculate their share
            distribution[0].share = (distribution[0].percentage / 100 * winnerPool).toFixed(4);
        }

        setWinnerDistribution(distribution);
    }, [winners, tournamentDetails]);

    const handleEndTournament = async () => {
        if (!tournamentId || winners.length === 0 || !isHost) {
            setError('Cannot end tournament: missing tournament ID, winners, or host permission');
            return;
        }

        setIsEndingTournament(true);
        setError(null);

        try {
            // Get winner addresses and percentages from the calculated distribution
            const winnerAddresses = winnerDistribution.map(w => w.address);
            const percentages = winnerDistribution.map(w => w.percentage);

            console.log('Ending tournament with winners:', {
                tournamentId,
                winnerAddresses,
                percentages,
                totalSum: percentages.reduce((sum, p) => sum + p, 0)
            });

            // Call the smart contract
            const result = await endTournament(
                parseInt(tournamentId),
                winnerAddresses,
                percentages
            );

            console.log('Tournament ended:', result);

            // Update Supabase with the results using the new byid route
            const updateResponse = await fetch(`/api/tournament/byid/${tournamentId}/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    winners: winnerDistribution.map(winner => ({
                        name: winner.name,
                        address: winner.address,
                        percentage: winner.percentage,
                        share: winner.share
                    })),
                    txHash: result.hash
                })
            });

            const updateData = await updateResponse.json();

            if (!updateResponse.ok) {
                throw new Error(updateData.error || 'Failed to update tournament results');
            }

            // Reload tournament details
            const updatedDetails = await getTournamentDetails(parseInt(tournamentId));
            setTournamentDetails(updatedDetails);

            alert('Tournament ended successfully! Prizes have been distributed.');

        } catch (err: any) {
            console.error('Error ending tournament:', err);
            setError(err.message || 'Failed to end tournament');
        } finally {
            setIsEndingTournament(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-blue-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-blue-200 rounded"></div>
                            <div className="h-4 bg-blue-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-4 rounded-lg mb-4">
                <p className="text-center text-red-700">Error: {error}</p>
            </div>
        );
    }

    if (!tournamentDetails) {
        return (
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <p className="text-center text-yellow-700">No tournament information available</p>
            </div>
        );
    }

    const formattedEntryFee = ethers.utils.formatEther(tournamentDetails.entryFee.toString());
    const totalPrizePool = parseFloat(formattedEntryFee) * parseInt(tournamentDetails.numEntrants);
    const remainingBalance = parseFloat(ethers.utils.formatEther(tournamentDetails.remainingBalance || '0'));

    return (
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">Tournament #{tournamentId}</h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="text-sm text-blue-700">
                    <span className="font-medium">Status:</span> {tournamentDetails.isActive ? 'Active' : 'Inactive'}
                    {tournamentDetails.hasStarted ? ' (Started)' : ' (Not Started)'}
                </div>
                <div className="text-sm text-blue-700">
                    <span className="font-medium">Entry Fee:</span> {formattedEntryFee} ETH
                </div>
                <div className="text-sm text-blue-700">
                    <span className="font-medium">Players:</span> {tournamentDetails.currentEntrants || '0'} / {tournamentDetails.numEntrants}
                </div>
                <div className="text-sm text-blue-700">
                    <span className="font-medium">Prize Pool:</span> {totalPrizePool.toFixed(4)} ETH
                </div>
                <div className="text-sm text-blue-700">
                    <span className="font-medium">Winners %:</span> {tournamentDetails.winnersPercentage}%
                </div>
                <div className="text-sm text-blue-700">
                    <span className="font-medium">Platform Fee:</span> {tournamentDetails.multisigPercentage}%
                </div>
            </div>

            {isParticipant && (
                <div className="bg-green-100 text-green-700 p-2 rounded text-sm mb-3">
                    You are a participant in this tournament
                </div>
            )}

            {/* Show winners if available */}
            {winners.length > 0 && (
                <div className="mt-3">
                    <h4 className="font-medium text-blue-800 mb-1">Current Rankings:</h4>
                    <div className="bg-white p-2 rounded-md">
                        {winners.map((winner, index) => (
                            <div key={index} className="flex justify-between items-center py-1 border-b last:border-0 border-gray-100">
                                <div className="flex items-center">
                                    <span className="font-medium mr-2">#{index + 1}</span>
                                    <span>{winner.name}</span>
                                </div>
                                <span className="font-medium">{winner.score} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* End Tournament button (only for host) */}
            {isHost && tournamentDetails.isActive && (
                <button
                    onClick={handleEndTournament}
                    disabled={isEndingTournament || winners.length === 0}
                    className={`mt-3 w-full py-2 px-4 rounded font-medium ${isEndingTournament || winners.length === 0
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                >
                    {isEndingTournament ? 'Ending Tournament...' : 'End Tournament & Distribute Prizes'}
                </button>
            )}

            {/* Tournament completed message */}
            {!tournamentDetails.isActive && tournamentDetails.hasStarted && (
                <div className="bg-green-100 text-green-700 p-2 rounded text-center font-medium mt-3">
                    Tournament has been completed and prizes distributed
                </div>
            )}
        </div>
    );
}