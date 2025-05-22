// Quick diagnostics script to check for rate limiting issues
// Add this to a new page or component where you can trigger it

import { useState } from 'react';

export default function DiagnosticTool() {
    const [results, setResults] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState(null);

    // Function to check API endpoints
    const runDiagnostics = async () => {
        setIsRunning(true);
        setResults([]);
        setError(null);

        try {
            // Log diagnostic start
            addResult('Starting API diagnostics...');

            // Test GET /api/tournament endpoint
            addResult('Testing GET /api/tournament...');
            try {
                const getTournamentResponse = await fetch('/api/tournament', {
                    headers: {
                        'X-Diagnostic-Run': 'true',
                        'Cache-Control': 'no-cache, no-store'
                    }
                });

                const headers = {};
                getTournamentResponse.headers.forEach((value, key) => {
                    headers[key] = value;
                });

                addResult(`GET /api/tournament status: ${getTournamentResponse.status}`);
                addResult(`Response headers: ${JSON.stringify(headers, null, 2)}`);

                // Check for rate limit headers
                if (headers['x-ratelimit-limit']) {
                    addResult(`Rate limit info: ${headers['x-ratelimit-remaining']}/${headers['x-ratelimit-limit']} remaining`);

                    if (parseInt(headers['x-ratelimit-remaining']) < 5) {
                        addResult('⚠️ WARNING: You are close to rate limit exhaustion!', 'warning');
                    }
                }

                // Check response body
                const data = await getTournamentResponse.json();
                addResult(`Response data contains ${data.tournaments ? data.tournaments.length : 0} tournaments`);

            } catch (e) {
                addResult(`Error testing GET /api/tournament: ${e.message}`, 'error');
            }

            // Test mock POST /api/tournament with minimal data to see if it's a rate limit issue
            addResult('Testing mock POST /api/tournament to check for rate limits...');
            try {
                // Don't actually create a tournament, just check headers
                const postTournamentResponse = await fetch('/api/tournament', {
                    method: 'HEAD',  // Just get headers, don't actually POST
                    headers: {
                        'X-Diagnostic-Run': 'true',
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store'
                    }
                });

                const headers = {};
                postTournamentResponse.headers.forEach((value, key) => {
                    headers[key] = value;
                });

                addResult(`HEAD /api/tournament status: ${postTournamentResponse.status}`);
                addResult(`Response headers: ${JSON.stringify(headers, null, 2)}`);

                // Check for rate limit headers
                if (headers['x-ratelimit-limit']) {
                    addResult(`Rate limit info: ${headers['x-ratelimit-remaining']}/${headers['x-ratelimit-limit']} remaining`);

                    if (parseInt(headers['x-ratelimit-remaining']) < 5) {
                        addResult('⚠️ WARNING: You are close to rate limit exhaustion!', 'warning');
                    }
                }
            } catch (e) {
                addResult(`Error testing POST /api/tournament: ${e.message}`, 'error');
            }

            // Test localStorage for race conditions
            addResult('Checking localStorage for contract cache entries...');
            const contractKeys = Object.keys(localStorage).filter(key => key.startsWith('contract_'));
            addResult(`Found ${contractKeys.length} contract cache entries in localStorage`);

            if (contractKeys.length > 0) {
                // List the first 5 keys
                addResult(`Sample keys: ${contractKeys.slice(0, 5).join(', ')}`);

                // Check for tournament-related cache entries
                const tournamentKeys = contractKeys.filter(key => key.includes('tournament'));
                addResult(`Found ${tournamentKeys.length} tournament-related cache entries`);

                // Optional: Clear these entries if there are too many
                if (tournamentKeys.length > 50) {
                    addResult('WARNING: High number of tournament cache entries detected. Consider clearing cache.', 'warning');
                }
            }

            // Diagnostic complete
            addResult('Diagnostics complete!');

        } catch (error) {
            setError(`Failed to run diagnostics: ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    // Helper to add a result
    const addResult = (message, type = 'info') => {
        setResults(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
    };

    // Clear localStorage cache function
    const clearContractCache = () => {
        try {
            const contractKeys = Object.keys(localStorage).filter(key => key.startsWith('contract_'));
            contractKeys.forEach(key => localStorage.removeItem(key));
            addResult(`Cleared ${contractKeys.length} contract cache entries from localStorage`);
        } catch (e) {
            addResult(`Error clearing cache: ${e.message}`, 'error');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">API Diagnostics Tool</h1>

            <div className="flex space-x-4 mb-6">
                <button
                    onClick={runDiagnostics}
                    disabled={isRunning}
                    className={`px-4 py-2 rounded-md ${isRunning ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                >
                    {isRunning ? 'Running...' : 'Run Diagnostics'}
                </button>

                <button
                    onClick={clearContractCache}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md"
                >
                    Clear Contract Cache
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            <div className="bg-gray-100 border border-gray-300 rounded-md p-4 h-[500px] overflow-auto font-mono text-sm">
                {results.length === 0 ? (
                    <p className="text-gray-500">Run diagnostics to see results</p>
                ) : (
                    <div className="space-y-1">
                        {results.map((result, index) => (
                            <div
                                key={index}
                                className={`
                  ${result.type === 'error' ? 'text-red-600' :
                                        result.type === 'warning' ? 'text-yellow-600' : 'text-gray-800'}
                `}
                            >
                                <span className="text-gray-500 mr-2">[{result.timestamp.substring(11, 19)}]</span>
                                {result.message}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}