// Enhanced CreateTournamentModal Component with Dedicated Number of Participants Field

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { ethers } from "ethers";

type CreateTournamentModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (tournamentId: number, txHash: string) => void;
    gameSettings: {
        playerName: string;
        numEntrants?: number; // Now optional since we'll have a dedicated field
        category: string;
        questionCount: number;
        timerDuration: number;
        suddenDeath: boolean;
        roomCode: string;
    };
};

export function CreateTournamentModal({
    isOpen,
    onClose,
    onSuccess,
    gameSettings
}: CreateTournamentModalProps) {
    // Tournament-specific settings
    const [entryFee, setEntryFee] = useState("0.01");
    const [maxParticipants, setMaxParticipants] = useState(gameSettings.numEntrants || 5);
    const [winnersPercentage, setWinnersPercentage] = useState(80);
    const [multisigPercentage, setMultisigPercentage] = useState(10);
    const [isCreating, setIsCreating] = useState(false);

    // Calculate total prize pool
    const totalPrize = parseFloat(entryFee) * maxParticipants;

    const router = useRouter();
    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const { createTournament, isLoading, error } = useTournamentContract();

    const handleCreateTournament = async (e: React.FormEvent) => {
        e.preventDefault();

        if (connectionStatus !== "connected" || !address) {
            alert("Please connect your wallet to create a tournament");
            return;
        }

        // Validate percentages
        if (winnersPercentage + multisigPercentage > 100) {
            alert("Winners percentage and platform fee cannot exceed 100%");
            return;
        }

        // Validate max participants
        if (maxParticipants < 2) {
            alert("Tournament must have at least 2 participants");
            return;
        }

        setIsCreating(true);

        try {
            // Create tournament on-chain using zero address for ETH tournaments
            const zeroAddress = "0x0000000000000000000000000000000000000000";

            const tx = await createTournament({
                numEntrants: maxParticipants,
                winnersPercentage,
                multisigPercentage,
                tokenAddress: zeroAddress,
                entryFee
            });

            console.log("Tournament created:", tx);

            // Get the tournament ID from the transaction
            const tournamentId = parseInt(tx.tournamentId || '1');

            // Call the success callback with tournament ID and tx hash
            onSuccess(tournamentId, tx.hash);
            onClose();

        } catch (err: any) {
            console.error("Failed to create tournament:", err);
            alert(`Error creating tournament: ${err.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Create Tournament</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <h3 className="font-medium text-blue-800 mb-1">Game Settings</h3>
                        <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                            <div><span className="text-gray-600">Room:</span> {gameSettings.roomCode}</div>
                            <div><span className="text-gray-600">Host:</span> {gameSettings.playerName}</div>
                            <div><span className="text-gray-600">Questions:</span> {gameSettings.questionCount}</div>
                            <div><span className="text-gray-600">Timer:</span> {gameSettings.timerDuration}s</div>
                            <div><span className="text-gray-600">Mode:</span> {gameSettings.suddenDeath ? 'Sudden Death' : 'Standard'}</div>
                        </div>
                    </div>

                    <form onSubmit={handleCreateTournament}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="max-participants" className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Participants
                                </label>
                                <input
                                    id="max-participants"
                                    type="number"
                                    min="2"
                                    max="100"
                                    value={maxParticipants}
                                    onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                                    className="w-full p-2 border border-gray-300 rounded"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    The maximum number of players that can join this tournament
                                </p>
                            </div>

                            <div>
                                <label htmlFor="entry-fee" className="block text-sm font-medium text-gray-700 mb-1">
                                    Entry Fee (ETH)
                                </label>
                                <input
                                    id="entry-fee"
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    value={entryFee}
                                    onChange={(e) => setEntryFee(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded"
                                    required
                                />
                            </div>

                            <div className="p-3 bg-green-50 rounded-lg">
                                <div className="font-medium text-green-800 mb-1">Total Prize Pool</div>
                                <div className="text-xl font-bold text-green-700">{totalPrize.toFixed(3)} ETH</div>
                                <p className="text-xs text-green-600 mt-1">
                                    Based on {maxParticipants} participants × {entryFee} ETH each
                                </p>
                            </div>

                            <div>
                                <label htmlFor="winners-percentage" className="block text-sm font-medium text-gray-700 mb-1">
                                    Winners Percentage (%)
                                </label>
                                <input
                                    id="winners-percentage"
                                    type="number"
                                    min="50"
                                    max="95"
                                    value={winnersPercentage}
                                    onChange={(e) => setWinnersPercentage(parseInt(e.target.value))}
                                    className="w-full p-2 border border-gray-300 rounded"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Percentage of the prize pool that goes to winners
                                </p>
                            </div>

                            <div>
                                <label htmlFor="multisig-percentage" className="block text-sm font-medium text-gray-700 mb-1">
                                    Platform Fee (%)
                                </label>
                                <input
                                    id="multisig-percentage"
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={multisigPercentage}
                                    onChange={(e) => setMultisigPercentage(parseInt(e.target.value))}
                                    className="w-full p-2 border border-gray-300 rounded"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Percentage that goes to the platform
                                </p>
                            </div>

                            {!address && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                                    You need to connect your wallet to create a tournament.
                                </div>
                            )}

                            <div className="pt-4 flex space-x-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || !address}
                                    className={`flex-1 py-2 px-4 rounded font-medium ${isCreating || !address
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                >
                                    {isCreating ? 'Creating...' : 'Create Tournament'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}