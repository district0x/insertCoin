// components/TournamentCreationDebug.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";

export function TournamentCreationDebug() {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [logs, setLogs] = useState<string[]>([]);
    const [testParams, setTestParams] = useState({
        numEntrants: 5,
        winnersPercentage: 80,
        multisigPercentage: 10,
        entryFee: '0.01',
    });
    const [apiResponse, setApiResponse] = useState<any>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const { createTournament } = useTournamentContract();

    const addLog = (message: string) => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const testSupabaseConnection = async () => {
        try {
            addLog('Testing Supabase connection...');
            const response = await fetch('/api/diagnostics/supabase');
            const data = await response.json();
            addLog(`Supabase connection: ${data.validation?.success ? 'Success' : 'Failed'}`);
            addLog(`Message: ${data.validation?.message}`);

            if (data.tableChecks) {
                Object.entries(data.tableChecks).forEach(([table, check]) => {
                    addLog(`Table ${table}: ${check.exists ? 'Exists' : 'Missing'}`);
                    if (check.error) {
                        addLog(`  Error: ${check.error}`);
                    }
                });
            }

            setApiResponse(data);
            setStep(2);
        } catch (err: any) {
            addLog(`Error testing Supabase: ${err.message}`);
            setError(err.message);
        }
    };

    const testContractConnection = async () => {
        if (connectionStatus !== 'connected') {
            addLog('Please connect your wallet first');
            return;
        }

        try {
            addLog('Creating a test tournament on the blockchain...');
            setIsCreating(true);

            // Create a random room code
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            addLog(`Generated room code: ${roomCode}`);

            // Call contract function
            const zeroAddress = "0x0000000000000000000000000000000000000000";

            const result = await createTournament({
                numEntrants: testParams.numEntrants,
                winnersPercentage: testParams.winnersPercentage,
                multisigPercentage: testParams.multisigPercentage,
                tokenAddress: zeroAddress,
                entryFee: testParams.entryFee
            });

            addLog(`Tournament created on blockchain with ID: ${result.tournamentId}`);
            addLog(`Transaction hash: ${result.hash}`);

            // Now try to store in Supabase
            addLog('Storing tournament in Supabase...');

            const storeResponse = await fetch('/api/tournament', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tournamentId: result.tournamentId,
                    roomCode: roomCode,
                    entryFee: testParams.entryFee,
                    maxParticipants: testParams.numEntrants,
                    tokenAddress: zeroAddress,
                    walletAddress: address,
                    txHash: result.hash
                })
            });

            const storeData = await storeResponse.json();

            if (storeResponse.ok) {
                addLog('Tournament successfully stored in Supabase');
                addLog(`Room code: ${roomCode} (save this to join the tournament)`);
            } else {
                addLog(`Failed to store tournament: ${storeData.error}`);
                setError(storeData.error);
            }

            setApiResponse(storeData);
            setStep(3);
        } catch (err: any) {
            addLog(`Error creating tournament: ${err.message}`);
            setError(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed bottom-4 left-4">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded font-medium hover:bg-purple-700"
                >
                    Debug Tournament
                </button>
            ) : (
                <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-4 w-96 max-h-[80vh] overflow-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Tournament Debug</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm">Test your tournament creation process to diagnose any issues.</p>

                            <button
                                onClick={testSupabaseConnection}
                                className="w-full py-2 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                            >
                                1. Test Supabase Connection
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-sm">Supabase connection test completed.</p>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium">Test Parameters</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs">Num Entrants</label>
                                        <input
                                            type="number"
                                            value={testParams.numEntrants}
                                            onChange={(e) => setTestParams({ ...testParams, numEntrants: parseInt(e.target.value) })}
                                            className="w-full p-2 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs">Entry Fee (ETH)</label>
                                        <input
                                            type="text"
                                            value={testParams.entryFee}
                                            onChange={(e) => setTestParams({ ...testParams, entryFee: e.target.value })}
                                            className="w-full p-2 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs">Winners %</label>
                                        <input
                                            type="number"
                                            value={testParams.winnersPercentage}
                                            onChange={(e) => setTestParams({ ...testParams, winnersPercentage: parseInt(e.target.value) })}
                                            className="w-full p-2 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs">Platform Fee %</label>
                                        <input
                                            type="number"
                                            value={testParams.multisigPercentage}
                                            onChange={(e) => setTestParams({ ...testParams, multisigPercentage: parseInt(e.target.value) })}
                                            className="w-full p-2 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={testContractConnection}
                                disabled={isCreating || connectionStatus !== 'connected'}
                                className={`w-full py-2 px-4 rounded font-medium ${isCreating || connectionStatus !== 'connected'
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                            >
                                {connectionStatus !== 'connected'
                                    ? 'Connect Wallet First'
                                    : isCreating
                                        ? 'Creating Tournament...'
                                        : '2. Create Test Tournament'}
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <p className="text-sm">Tournament creation test completed.</p>

                            {error ? (
                                <div className="p-3 bg-red-100 text-red-700 rounded-md">
                                    <p className="font-medium">Error occurred:</p>
                                    <p className="text-sm">{error}</p>
                                </div>
                            ) : (
                                <div className="p-3 bg-green-100 text-green-700 rounded-md">
                                    <p className="font-medium">Test successful!</p>
                                    <p className="text-sm">Your tournament creation process is working correctly.</p>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    setStep(1);
                                    setLogs([]);
                                    setError(null);
                                    setApiResponse(null);
                                }}
                                className="w-full py-2 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                            >
                                Start Over
                            </button>
                        </div>
                    )}

                    <div className="mt-4 border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium mb-2">Debug Logs:</h4>
                        <div className="bg-gray-100 p-2 rounded text-xs font-mono h-40 overflow-auto">
                            {logs.length === 0 ? (
                                <p className="text-gray-500">Logs will appear here...</p>
                            ) : (
                                logs.map((log, i) => <div key={i}>{log}</div>)
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}