// pages/debug-tournament.jsx
import { useState } from 'react';
import { useTournamentContract } from '@/hooks/useTournamentContract';

export default function DebugTournamentCreation() {
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const { createTournamentDebug } = useTournamentContract(); // You'll need to export this

    const testTournamentCreation = async () => {
        setIsLoading(true);
        try {
            const result = await createTournamentDebug({
                numEntrants: 5,
                winnersPercentage: 80,
                multisigPercentage: 10,
                tokenAddress: "0x0000000000000000000000000000000000000000",
                entryFee: "0.01"
            });

            setResult(result);
            console.log("Debug tournament creation result:", result);
        } catch (error) {
            console.error("Debug failed:", error);
            setResult({ error: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Tournament Creation Debug</h1>

            <button
                onClick={testTournamentCreation}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
                {isLoading ? 'Creating Test Tournament...' : 'Create Test Tournament'}
            </button>

            {result && (
                <div className="mt-6">
                    <h2 className="text-xl font-bold mb-2">Result:</h2>
                    <div className="bg-gray-100 p-4 rounded overflow-auto h-[500px]">
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}