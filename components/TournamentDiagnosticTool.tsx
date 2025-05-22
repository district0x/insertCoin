// components/TournamentDiagnosticTool.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAddress, useConnectionStatus, useChainId } from "@thirdweb-dev/react";
import { ethers } from 'ethers';

interface DiagnosticResult {
    name: string;
    status: 'success' | 'warning' | 'error' | 'pending';
    message: string;
    details?: string;
}

export function TournamentDiagnosticTool() {
    const [isOpen, setIsOpen] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<DiagnosticResult[]>([]);
    const [contractAddress, setContractAddress] = useState<string>('');
    const [apiEndpoints, setApiEndpoints] = useState<string[]>([]);

    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const chainId = useChainId();

    // Load contract address from environment
    useEffect(() => {
        const envContractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS;
        if (envContractAddress) {
            setContractAddress(envContractAddress);
        }
    }, []);

    // Run diagnostics
    const runDiagnostics = async () => {
        setIsRunning(true);
        setResults([]);

        // Add initial result - checking wallet connection
        addResult({
            name: 'Wallet Connection',
            status: 'pending',
            message: 'Checking wallet connection...'
        });

        // Sequence tests to run in order
        await checkWalletConnection();
        await checkNetwork();
        await checkContractAvailability();
        await checkApiEndpoints();

        setIsRunning(false);
    };

    // Add a result to the list
    const addResult = (result: DiagnosticResult) => {
        setResults(prev => {
            // Check if this result already exists
            const index = prev.findIndex(r => r.name === result.name);

            if (index !== -1) {
                // Update existing result
                const newResults = [...prev];
                newResults[index] = result;
                return newResults;
            } else {
                // Add new result
                return [...prev, result];
            }
        });
    };

    // Check wallet connection
    const checkWalletConnection = async () => {
        try {
            if (connectionStatus === 'connected' && address) {
                addResult({
                    name: 'Wallet Connection',
                    status: 'success',
                    message: 'Wallet connected successfully',
                    details: `Address: ${address}`
                });
            } else if (connectionStatus === 'connecting') {
                addResult({
                    name: 'Wallet Connection',
                    status: 'warning',
                    message: 'Wallet is currently connecting',
                    details: 'Please complete the connection process in your wallet'
                });
            } else {
                addResult({
                    name: 'Wallet Connection',
                    status: 'error',
                    message: 'Wallet not connected',
                    details: 'Please connect your wallet to access tournament features'
                });
            }
        } catch (err: any) {
            addResult({
                name: 'Wallet Connection',
                status: 'error',
                message: 'Error checking wallet connection',
                details: err.message
            });
        }
    };

    // Check network connection
    const checkNetwork = async () => {
        try {
            addResult({
                name: 'Network Check',
                status: 'pending',
                message: 'Checking network connection...'
            });

            if (!address) {
                addResult({
                    name: 'Network Check',
                    status: 'warning',
                    message: 'Wallet not connected, cannot check network',
                    details: 'Connect your wallet first'
                });
                return;
            }

            // Check chain ID
            const expectedChainId = 137; // Polygon Mainnet
            const testnetChainId = 80001; // Mumbai Testnet

            if (chainId === expectedChainId) {
                addResult({
                    name: 'Network Check',
                    status: 'success',
                    message: 'Connected to Polygon Mainnet',
                    details: `Chain ID: ${chainId}`
                });
            } else if (chainId === testnetChainId) {
                addResult({
                    name: 'Network Check',
                    status: 'warning',
                    message: 'Connected to Polygon Mumbai Testnet',
                    details: 'This is a test network. For production, connect to Polygon Mainnet'
                });
            } else if (chainId === 1) {
                addResult({
                    name: 'Network Check',
                    status: 'error',
                    message: 'Connected to Ethereum Mainnet',
                    details: 'Please switch to Polygon network to use the tournament'
                });
            } else if (chainId) {
                addResult({
                    name: 'Network Check',
                    status: 'error',
                    message: `Connected to unknown network (Chain ID: ${chainId})`,
                    details: 'Please switch to Polygon network to use the tournament'
                });
            } else {
                addResult({
                    name: 'Network Check',
                    status: 'error',
                    message: 'Unable to detect network',
                    details: 'Please check your wallet connection'
                });
            }
        } catch (err: any) {
            addResult({
                name: 'Network Check',
                status: 'error',
                message: 'Error checking network',
                details: err.message
            });
        }
    };

    // Check contract availability
    const checkContractAvailability = async () => {
        try {
            addResult({
                name: 'Contract Check',
                status: 'pending',
                message: 'Checking tournament contract...'
            });

            if (!contractAddress) {
                addResult({
                    name: 'Contract Check',
                    status: 'error',
                    message: 'Tournament contract address not set',
                    details: 'Check the environment variable NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS'
                });
                return;
            }

            if (!ethers.utils.isAddress(contractAddress)) {
                addResult({
                    name: 'Contract Check',
                    status: 'error',
                    message: 'Invalid tournament contract address',
                    details: `Address ${contractAddress} is not a valid Ethereum address`
                });
                return;
            }

            // Basic contract check - just verify it's a valid address for now
            // In a production version, we'd make a call to the contract to verify it's the right one
            addResult({
                name: 'Contract Check',
                status: 'success',
                message: 'Tournament contract address is valid',
                details: `Contract address: ${contractAddress}`
            });
        } catch (err: any) {
            addResult({
                name: 'Contract Check',
                status: 'error',
                message: 'Error checking tournament contract',
                details: err.message
            });
        }
    };

    // Check API endpoints
    const checkApiEndpoints = async () => {
        try {
            addResult({
                name: 'API Check',
                status: 'pending',
                message: 'Checking API endpoints...'
            });

            // Test tournament API
            try {
                const response = await fetch('/api/tournament');

                if (response.ok) {
                    const data = await response.json();
                    addResult({
                        name: 'API Check',
                        status: 'success',
                        message: 'Tournament API is accessible',
                        details: `Successfully fetched data from /api/tournament endpoint`
                    });
                } else {
                    addResult({
                        name: 'API Check',
                        status: 'error',
                        message: 'Tournament API error',
                        details: `Received HTTP ${response.status} from /api/tournament endpoint`
                    });
                }
            } catch (apiErr: any) {
                addResult({
                    name: 'API Check',
                    status: 'error',
                    message: 'Tournament API connection error',
                    details: apiErr.message
                });
            }

            // Test Supabase connection via diagnostics endpoint
            try {
                const response = await fetch('/api/diagnostics/supabase');

                if (response.ok) {
                    const data = await response.json();
                    if (data.validation?.success) {
                        addResult({
                            name: 'Database Check',
                            status: 'success',
                            message: 'Supabase connection successful',
                            details: data.validation.message
                        });
                    } else {
                        addResult({
                            name: 'Database Check',
                            status: 'error',
                            message: 'Supabase connection failed',
                            details: data.validation?.message || 'Unknown error'
                        });
                    }
                } else {
                    addResult({
                        name: 'Database Check',
                        status: 'error',
                        message: 'Diagnostics API error',
                        details: `Received HTTP ${response.status} from diagnostics endpoint`
                    });
                }
            } catch (dbErr: any) {
                addResult({
                    name: 'Database Check',
                    status: 'error',
                    message: 'Database connection error',
                    details: dbErr.message
                });
            }
        } catch (err: any) {
            addResult({
                name: 'API Check',
                status: 'error',
                message: 'Error checking API endpoints',
                details: err.message
            });
        }
    };

    // Get status icon
    const getStatusIcon = (status: DiagnosticResult['status']) => {
        switch (status) {
            case 'success':
                return (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                );
            case 'warning':
                return (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                    </svg>
                );
            case 'error':
                return (
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                    </svg>
                );
            case 'pending':
                return (
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                );
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                    </svg>
                    Diagnostics
                </button>
            ) : (
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-96 max-h-[80vh] overflow-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Tournament Diagnostics</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="mb-4">
                        <button
                            onClick={runDiagnostics}
                            disabled={isRunning}
                            className={`w-full py-2 px-4 rounded font-medium ${isRunning
                                    ? 'bg-gray-400 cursor-not-allowed text-white'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {isRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
                        </button>
                    </div>

                    {results.length > 0 ? (
                        <div className="space-y-3">
                            {results.map((result, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded-lg ${result.status === 'success'
                                            ? 'bg-green-50 border border-green-100'
                                            : result.status === 'warning'
                                                ? 'bg-yellow-50 border border-yellow-100'
                                                : result.status === 'error'
                                                    ? 'bg-red-50 border border-red-100'
                                                    : 'bg-blue-50 border border-blue-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(result.status)}
                                        <span className="font-medium">{result.name}</span>
                                    </div>
                                    <div className="mt-1 text-sm">
                                        {result.message}
                                    </div>
                                    {result.details && (
                                        <div className="mt-1 text-xs text-gray-500">
                                            {result.details}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 p-4">
                            {isRunning ? (
                                <div className="flex flex-col items-center">
                                    <svg className="w-8 h-8 text-blue-500 animate-spin mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                    </svg>
                                    <p>Running diagnostics...</p>
                                </div>
                            ) : (
                                <p>Click "Run Diagnostics" to check your tournament configuration</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}