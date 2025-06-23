import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

interface Tournament {
    id: string;
    tournamentId: string;
    roomCode: string;
    entryFee: string;
    entryFeeFormatted?: string;
    maxParticipants: number;
    currentParticipants: number;
    totalPrize: number;
    status: string;
}

interface TournamentJoinModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    onJoin: (name: string) => void;
}

export function TournamentJoinModal({ isOpen, onClose, tournament, onJoin }: TournamentJoinModalProps) {
    const [playerName, setPlayerName] = useState('');
    const { authenticated: isAuthenticated, user, login: signIn } = usePrivy();
    console.log('Privy:', { isAuthenticated, user });

    if (!isOpen) return null;

    const handleJoin = async () => {
        if (!playerName.trim()) {
            alert('Please enter your name');
            return;
        }
        if (!isAuthenticated) {
            alert('Please sign in with your wallet to join a tournament');
            await signIn();
            return;
        }
        if (!user?.wallet?.address) {
            alert('Please connect your wallet to join a tournament');
            return;
        }
        onJoin(playerName);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <h3 className="text-xl font-semibold mb-4">Join Tournament</h3>

                {/* Tournament Info */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="font-medium text-blue-800 mb-2">Tournament Details</p>
                    <div className="text-sm text-blue-700 space-y-1">
                        <div className="flex justify-between">
                            <span>Entry Fee:</span>
                            <span className="font-medium">{tournament.entryFeeFormatted || tournament.entryFee} ETH</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Prize Pool:</span>
                            <span className="font-medium">{tournament.totalPrize} ETH</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Players:</span>
                            <span className="font-medium">{tournament.currentParticipants} / {tournament.maxParticipants}</span>
                        </div>
                    </div>
                </div>

                {/* Name Input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Name
                    </label>
                    <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                    />
                </div>

                {/* Wallet Status */}
                {!user?.wallet?.address && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">
                            Please connect your wallet to join this tournament
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleJoin}
                        disabled={!playerName.trim() || !user?.wallet?.address}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        Join Game
                    </button>
                </div>
            </div>
        </div>
    );
} 