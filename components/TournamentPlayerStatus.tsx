// components/TournamentPlayerStatus.tsx
import { useState, useEffect } from 'react';
import { useAddress } from "@thirdweb-dev/react";
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { Player } from '@/app/types';

interface TournamentPlayerStatusProps {
    tournamentId: string;
    players: Player[];
}

export function TournamentPlayerStatus({ tournamentId, players }: TournamentPlayerStatusProps) {
    const [tournamentDetails, setTournamentDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tournamentParticipants, setTournamentParticipants] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const { getTournamentDetails, isEntrantInTournament } = useTournamentContract();

    // Fetch tournament details from the blockchain
    useEffect(() => {
        if (!tournamentId) return;

        const fetchTournamentDetails = async () => {
            try {
                setIsLoading(true);
                const details = await getTournamentDetails(parseInt(tournamentId));
                setTournamentDetails(details);
            } catch (err: any) {
                console.error('Error fetching tournament details:', err);
                setError(err.message || 'Failed to load tournament details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTournamentDetails();
    }, [tournamentId, getTournamentDetails]);

    // Check which players have actually joined the tournament on the blockchain
    useEffect(() => {
        if (!tournamentId || players.length === 0) return;

        const checkTournamentParticipation = async () => {
            try {
                const participants: string[] = [];

                // Check each player with a wallet address
                for (const player of players) {
                    if (player.walletAddress) {
                        try {
                            const isParticipant = await isEntrantInTournament(
                                parseInt(tournamentId),
                                player.walletAddress
                            );

                            if (isParticipant) {
                                participants.push(player.id);
                            }
                        } catch (err) {
                            console.warn(`Error checking if player ${player.name} is in tournament:`, err);
                        }
                    }
                }

                setTournamentParticipants(participants);
            } catch (err) {
                console.error('Error checking tournament participants:', err);
            }
        };

        checkTournamentParticipation();
    }, [tournamentId, players, isEntrantInTournament]);

    if (isLoading) {
        return (
            <div className="p-2 text-center text-blue-700">
                <p className="text-sm">Checking tournament status...</p>
            </div>
        );
    }

    // Get participant counts regardless of tournament details
    const participantCount = tournamentParticipants.length;
    const playersWithoutWallet = players.filter(p => !p.walletAddress).length;
    const playersNotJoined = players.length - playersWithoutWallet - participantCount;

    return (
        <div className="bg-purple-50 p-3 rounded-lg mb-2">
            <h3 className="text-sm font-medium text-purple-800 mb-1">Tournament Player Status</h3>

            <div className="grid grid-cols-2 gap-1 mb-2 text-xs">
                <div className="text-purple-700">
                    <span className="font-medium">Game Players:</span> {players.length}
                </div>
                <div className="text-purple-700">
                    <span className="font-medium">Tournament Players:</span> {participantCount}
                </div>
                <div className="text-purple-700">
                    <span className="font-medium">Without Wallet:</span> {playersWithoutWallet}
                </div>
                <div className="text-purple-700">
                    <span className="font-medium">Not Joined:</span> {playersNotJoined}
                </div>
            </div>

            {tournamentDetails && (
                <div className="text-center text-xs bg-blue-50 p-2 rounded border border-blue-100">
                    <p className="text-blue-700">
                        Blockchain shows {tournamentDetails.currentEntrants || '0'} / {tournamentDetails.numEntrants} players
                    </p>
                </div>
            )}

            {error && (
                <div className="mt-1 text-xs text-red-600 text-center">
                    {error}
                </div>
            )}
        </div>
    );
}