// components/WinnerSummary.tsx
import { useState, useEffect } from 'react';
import { useTournamentContract } from '@/hooks/useTournamentContract';

interface WinnerSummaryProps {
    tournamentId: string;
    isCompleted?: boolean;
}

interface TournamentWinner {
    address: string;
    amount: string;
    percentage: number;
}

export const WinnerSummary = ({ tournamentId, isCompleted = false }: WinnerSummaryProps) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tournamentDetails, setTournamentDetails] = useState<any>(null);
    const [winners, setWinners] = useState<TournamentWinner[]>([]);
    const { getTournamentDetails } = useTournamentContract();

    useEffect(() => {
        const fetchTournamentDetails = async () => {
            try {
                setLoading(true);

                // Get tournament details from the contract
                const details = await getTournamentDetails(parseInt(tournamentId));
                setTournamentDetails(details);

                // For a real implementation, you'd get the actual winners and their prizes
                // Since this data isn't directly available through the contract interface we have,
                // we're just showing a placeholder message

                setLoading(false);
            } catch (err: any) {
                console.error("Error fetching tournament details:", err);
                setError(err.message || "Failed to load tournament details");
                setLoading(false);
            }
        };

        fetchTournamentDetails();
    }, [tournamentId, getTournamentDetails]);

    if (loading) {
        return (
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center">
                <p className="text-purple-700">Loading tournament results...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-red-700">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="text-lg font-semibold text-purple-800 mb-3">Tournament Results</h3>

            {isCompleted ? (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-green-700 font-medium">Prizes have been distributed!</p>
                    {tournamentDetails && (
                        <p className="text-sm text-green-600 mt-1">
                            Total prize pool: {tournamentDetails.entryFee * tournamentDetails.numEntrants} ETH
                        </p>
                    )}
                </div>
            ) : (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <p className="text-yellow-700">Tournament completed. Waiting for prize distribution.</p>
                </div>
            )}

            <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-center text-purple-700">
                    {isCompleted
                        ? "Congratulations to the winners!"
                        : "The host will distribute prizes shortly."}
                </p>
            </div>
        </div>
    );
};