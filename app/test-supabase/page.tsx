'use client';

import { useState, useEffect } from 'react';

export default function TestSupabasePage() {
    const [isLoading, setIsLoading] = useState(true);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Test Supabase connection when the page loads
    useEffect(() => {
        async function testConnection() {
            try {
                setIsLoading(true);
                const response = await fetch('/api/test-supabase');

                if (!response.ok) {
                    throw new Error(`API response error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                setResults(data);
            } catch (err: any) {
                console.error('Test failed:', err);
                setError(err.message || 'Connection test failed');
            } finally {
                setIsLoading(false);
            }
        }

        testConnection();
    }, []);

    // Function to test specific tables
    const testTable = async (tableName: string) => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/test-table?table=${tableName}`);

            if (!response.ok) {
                throw new Error(`API response error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setResults(prev => ({
                ...prev,
                tableTest: {
                    ...prev?.tableTest,
                    [tableName]: data
                }
            }));
        } catch (err: any) {
            setError(`Table test failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Supabase Connection Test</h1>

                {isLoading ? (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <p className="text-center text-gray-600">Testing connection...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 p-6 rounded-lg shadow-md border border-red-200">
                        <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
                        <p className="text-red-600">{error}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Environment Variables */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3">Environment Variables</h2>
                            {results?.environment ? (
                                <div className="space-y-2">
                                    {Object.entries(results.environment).map(([key, value]: [string, any]) => (
                                        <div key={key} className="flex justify-between border-b pb-2">
                                            <span className="font-medium">{key}:</span>
                                            <span className={value === 'undefined' ? 'text-red-600' : 'text-green-600'}>
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-yellow-600">No environment data available</p>
                            )}
                        </div>

                        {/* Connection Test */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3">Connection Test</h2>
                            {results?.connection ? (
                                <div>
                                    <div className={`p-3 mb-3 rounded-lg ${results.connection.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        <p className="font-semibold">Status: {results.connection.success ? 'Connected' : 'Failed'}</p>
                                        {!results.connection.success && (
                                            <p className="mt-1">{results.connection.error}</p>
                                        )}
                                    </div>

                                    {results.connection.success && results.tables && (
                                        <div>
                                            <h3 className="font-medium mb-2">Tables:</h3>
                                            <div className="space-y-2">
                                                {Object.entries(results.tables).map(([table, info]: [string, any]) => (
                                                    <div key={table} className="p-2 border rounded">
                                                        <div className="flex justify-between">
                                                            <span>{table}</span>
                                                            <span className={info.accessible ? 'text-green-600' : 'text-red-600'}>
                                                                {info.accessible ? 'Accessible' : 'Error'}
                                                            </span>
                                                        </div>
                                                        {info.error && <p className="text-sm text-red-600 mt-1">{info.error}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-yellow-600">No connection data available</p>
                            )}
                        </div>

                        {/* Supabase Instance */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3">Supabase Instance</h2>
                            {results?.supabaseInstance ? (
                                <div>
                                    <p><span className="font-medium">URL:</span> {results.supabaseInstance.url || 'Not set'}</p>
                                </div>
                            ) : (
                                <p className="text-yellow-600">No instance data available</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3">Actions</h2>
                            <div className="space-x-3">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Refresh Tests
                                </button>
                                <button
                                    onClick={() => testTable('Tournament')}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    Test Tournament Table
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}