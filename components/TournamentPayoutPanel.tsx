// components/EnhancedTournamentPayoutPanel.tsx
import { useState, useEffect } from 'react';
import { Player } from '@/app/types';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { ethers } from 'ethers';

interface TournamentPayoutPanelProps {
    tournamentId: string;
    isHost: boolean;
    players: Player[];
    onPayoutComplete: () => void;
    onError?: (error: string) => void;
}

export const TournamentPayoutPanel = ({
    tournamentId,
    isHost,
    players,
    onPayoutComplete,
    onError
}: TournamentPayoutPanelProps) => {
    const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
    const [percentages, setPercentages] = useState<number[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tournamentDetails, setTournamentDetails] = useState<any>(null);
    const [transactionHash, setTransactionHash] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const { endTournament, getTournamentDetails } = useTournamentContract();

    // Fetch tournament details for prize info
    useEffect(() => {
        const fetchTournamentDetails = async () => {
            if (!tournamentId) return;

            try {
                const details = await getTournamentDetails(parseInt(tournamentId));
                setTournamentDetails(details);
            } catch (err: any) {
                console.error("Error fetching tournament details:", err);
                setError(`Failed to fetch tournament details: ${err.message || "Unknown error"}`);
                if (onError) onError(err.message || "Failed to fetch tournament details");
            }
        };

        fetchTournamentDetails();
    }, [tournamentId, getTournamentDetails, onError]);

    // Initialize with default percentages based on top 3 players
    useEffect(() => {
        const playersWithWallets = players.filter(p => p.walletAddress && p.walletAddress !== '');

        if (playersWithWallets.length === 0) {
            console.warn('No players have connected wallets');
            setSelectedWinners([]);
            setPercentages([]);
            return;
        }

        // Take top 3 players with wallets by score
        const sortedPlayers = [...playersWithWallets].sort((a, b) => b.score - a.score);
        const top3Players = sortedPlayers.slice(0, 3).map(p => p.id);

        setSelectedWinners(top3Players);

        // Set default percentage splits based on number of winners
        if (top3Players.length === 1) {
            setPercentages([100]);
        } else if (top3Players.length === 2) {
            setPercentages([70, 30]);
        } else if (top3Players.length === 3) {
            setPercentages([60, 30, 10]);
        }
    }, [players]);

    // Update percentages when winners change
    useEffect(() => {
        const winnerCount = selectedWinners.length;
        let newPercentages: number[] = [];

        if (winnerCount === 1) {
            newPercentages = [100];
        } else if (winnerCount === 2) {
            newPercentages = [70, 30];
        } else if (winnerCount === 3) {
            newPercentages = [60, 30, 10];
        } else if (winnerCount > 3) {
            // For more winners, create a declining percentage scale
            const firstPlace = Math.max(40, 100 - (winnerCount - 1) * 15);
            newPercentages = [firstPlace];

            const remainingPercentage = 100 - firstPlace;
            const remainingWinners = winnerCount - 1;

            // Distribute remaining percentage among other winners
            for (let i = 0; i < remainingWinners - 1; i++) {
                const cut = Math.floor(remainingPercentage / (2 * remainingWinners) * (remainingWinners - i));
                newPercentages.push(cut);
            }

            // Ensure the last place gets at least something
            const lastPlace = Math.max(5, 100 - newPercentages.reduce((a, b) => a + b, 0));
            newPercentages.push(lastPlace);

            // Adjust to ensure sum is exactly 100
            const sum = newPercentages.reduce((a, b) => a + b, 0);
            if (sum !== 100) {
                newPercentages[0] += (100 - sum);
            }
        }

        setPercentages(newPercentages);
    }, [selectedWinners]);

    // Validate winner selection and percentages
    useEffect(() => {
        const errors = [];

        // Check if no winners selected
        if (selectedWinners.length === 0) {
            errors.push("Please select at least one winner");
        }

        // Check if percentages sum to 100
        const percentageSum = percentages.reduce((a, b) => a + b, 0);
        if (percentageSum !== 100) {
            errors.push(`Percentages must sum to 100% (currently ${percentageSum}%)`);
        }

        // Check if any winner doesn't have a wallet
        const selectedPlayersWithoutWallets = selectedWinners.filter(id => {
            const player = players.find(p => p.id === id);
            return !player?.walletAddress || player.walletAddress === '';
        });

        if (selectedPlayersWithoutWallets.length > 0) {
            errors.push(`${selectedPlayersWithoutWallets.length} selected winner(s) don't have connected wallets`);
        }

        setValidationErrors(errors);
    }, [selectedWinners, percentages, players]);

    const handleToggleWinner = (playerId: string) => {
        setSelectedWinners(prev => {
            if (prev.includes(playerId)) {
                return prev.filter(id => id !== playerId);
            } else {
                return [...prev, playerId];
            }
        });
    };

    const handlePercentageChange = (index: number, value: number) => {
        const newPercentages = [...percentages];
        newPercentages[index] = value;
        setPercentages(newPercentages);
    };

    const handleAdjustPercentages = () => {
        // Auto-adjust to ensure the total is 100%
        const total = percentages.reduce((sum, percent) => sum + percent, 0);

        if (total !== 100 && percentages.length > 0) {
            const newPercentages = [...percentages];

            // Adjust the first percentage to make the total 100%
            newPercentages[0] += (100 - total);

            setPercentages(newPercentages);
        }
    };

    const handleDistributePrizes = async () => {
        // Check validation errors
        if (validationErrors.length > 0) {
            setError(validationErrors.join(", "));
            return;
        }

        setIsProcessing(true);
        setError(null);
        setTransactionHash(null);

        try {
            // Get wallet addresses for selected winners
            const winnerAddresses = selectedWinners.map(winnerId => {
                const player = players.find(p => p.id === winnerId);
                // Add additional logging to help debug
                console.log("Player wallet data:", player?.id, player?.name, player?.walletAddress);
                if (!player?.walletAddress || player.walletAddress === '') {
                    throw new Error(`Player ${player?.name || 'Unknown'} has no wallet address`);
                }
                return player.walletAddress;
            });

            if (winnerAddresses.length === 0) {
                throw new Error("No valid wallet addresses found among winners");
            }

            // Log the winners and addresses for debugging
            console.log("Selected winners:", selectedWinners);
            console.log("Winner addresses:", winnerAddresses);
            console.log("Percentages:", percentages);

            // Ensure percentages array matches winners array length
            const finalPercentages = percentages.slice(0, winnerAddresses.length);

            // Final check if percentages add up to 100
            const totalPercentage = finalPercentages.reduce((a, b) => a + b, 0);
            if (totalPercentage !== 100) {
                finalPercentages[0] += (100 - totalPercentage);
            }

            // Call contract to end tournament and distribute prizes
            const txResult = await endTournament(
                parseInt(tournamentId),
                winnerAddresses,
                finalPercentages
            );

            console.log("Tournament ended successfully:", txResult);
            setTransactionHash(txResult.hash);

            // Update results in backend via API
            try {
                const winnerData = selectedWinners.map((winnerId, index) => {
                    const player = players.find(p => p.id === winnerId);
                    return {
                        name: player?.name || 'Unknown',
                        address: player?.walletAddress || '',
                        percentage: finalPercentages[index],
                        score: player?.score || 0
                    };
                });

                const apiResponse = await fetch(`/api/tournament/byid/${tournamentId}/results`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        winners: winnerData,
                        txHash: txResult.hash
                    })
                });

                if (!apiResponse.ok) {
                    console.warn("API update failed, but blockchain transaction succeeded");
                } else {
                    console.log("API update successful");
                }
            } catch (apiError) {
                console.warn("Error updating API:", apiError);
                // Don't fail the whole operation if just the API call fails
            }

            // Notify parent of successful payout
            onPayoutComplete();
        } catch (err: any) {
            console.error("Error distributing prizes:", err);
            const errorMessage = err.message || "Failed to distribute prizes";
            setError(errorMessage);
            if (onError) onError(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    // Calculate total prize pool
    const totalPrize = tournamentDetails
        ? parseFloat(ethers.utils.formatEther(tournamentDetails.remainingBalance || '0'))
        : 0;

    // Calculate prizes for each winner
    const calculatePrize = (percentage: number) => {
        if (!tournamentDetails) return '0';

        const winnerPoolPercentage = tournamentDetails.winnersPercentage || 80;
        const winnerPool = totalPrize * (winnerPoolPercentage / 100);
        const share = (percentage / 100) * winnerPool;

        return share.toFixed(4);
    };

    return (
        <div className="bg-purple-50 p-5 rounded-lg border border-purple-200 shadow-sm">
            <h3 className="text-lg font-semibold text-purple-800 mb-3">Tournament Prize Distribution</h3>

            {/* Error and transaction display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
                    {error}
                </div>
            )}

            {transactionHash && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded">
                    <p>Transaction submitted successfully!</p>
                    <div className="mt-1 text-xs break-all">
                        <span className="font-medium">TX Hash:</span> {transactionHash}
                    </div>
                </div>
            )}

            {/* Tournament prize info */}
            {tournamentDetails && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-blue-700 font-medium">Total Prize Pool:</span>
                        <span className="text-blue-700 font-bold">{totalPrize.toFixed(4)} ETH</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-700">Winners Share ({tournamentDetails.winnersPercentage}%):</span>
                        <span className="text-blue-700 font-medium">
                            {(totalPrize * (tournamentDetails.winnersPercentage / 100)).toFixed(4)} ETH
                        </span>
                    </div>
                </div>
            )}

            {/* Validation warnings */}
            {validationErrors.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-1">Please fix these issues:</h4>
                    <ul className="text-sm text-yellow-700 list-disc list-inside">
                        {validationErrors.map((err, index) => (
                            <li key={index}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mb-4">
                <div className="flex justify-between mb-2">
                    <h4 className="font-medium text-purple-800">Select Winners</h4>
                    <button
                        onClick={handleAdjustPercentages}
                        className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                        Auto-fix Percentages
                    </button>
                </div>

                <ul className="bg-white rounded-lg border border-purple-100 overflow-hidden divide-y divide-purple-100">
                    {players.sort((a, b) => b.score - a.score).map((player, index) => (
                        <li
                            key={player.id}
                            className={`p-3 ${player.eliminated ? 'bg-red-50' : 'bg-white'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`winner-${player.id}`}
                                        checked={selectedWinners.includes(player.id)}
                                        onChange={() => handleToggleWinner(player.id)}
                                        disabled={!player.walletAddress || player.walletAddress === '' || isProcessing}
                                        className="mr-2 h-4 w-4 text-purple-600 rounded"
                                    />
                                    <label htmlFor={`winner-${player.id}`} className="flex items-center">
                                        <span className="font-semibold mr-2">#{index + 1}</span>
                                        <span>{player.name}</span>
                                        <span className="ml-2 text-sm text-gray-500">({player.score} pts)</span>
                                    </label>
                                </div>

                                {/* Wallet status indicator */}
                                {(!player.walletAddress || player.walletAddress === '') ? (
                                    <span className="ml-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                        No wallet
                                    </span>
                                ) : (
                                    <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded truncate max-w-[140px]" title={player.walletAddress}>
                                        {player.walletAddress.substring(0, 6)}...{player.walletAddress.substring(player.walletAddress.length - 4)}
                                    </span>
                                )}
                            </div>

                            {/* Winner percentage settings (visible when selected) */}
                            {selectedWinners.includes(player.id) && (
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="text-sm text-purple-700 flex items-center gap-2">
                                        <span>Percentage:</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={percentages[selectedWinners.indexOf(player.id)]}
                                            onChange={(e) => handlePercentageChange(
                                                selectedWinners.indexOf(player.id),
                                                parseInt(e.target.value) || 0
                                            )}
                                            disabled={isProcessing}
                                            className="w-16 text-right p-1 border border-purple-200 rounded"
                                        />
                                        <span>%</span>
                                    </div>

                                    {tournamentDetails && (
                                        <div className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                                            Est. Prize: {calculatePrize(percentages[selectedWinners.indexOf(player.id)])} ETH
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mb-4">
                <div className="flex justify-between text-sm text-purple-700">
                    <span>Total percentage:</span>
                    <span className={percentages.reduce((a, b) => a + b, 0) !== 100 ? 'text-red-600 font-bold' : 'font-semibold'}>
                        {percentages.reduce((a, b) => a + b, 0)}%
                    </span>
                </div>
            </div>

            <button
                onClick={handleDistributePrizes}
                disabled={isProcessing || validationErrors.length > 0}
                className={`w-full py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
                {isProcessing ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing Transaction...
                    </>
                ) : (
                    'Distribute Prizes'
                )}
            </button>
        </div>
    );
};