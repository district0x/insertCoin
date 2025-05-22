'use client';

import { useState, useEffect } from 'react';

export default function TestAdminPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Test admin connection when the page loads
    useEffect(() => {
        async function testConnection() {
            try {
                setIsLoading(true);
                const response = await fetch('/api/test-admin');

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

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Supabase Admin Connection Test</h1>

                {isLoading ? (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <p className="text-center text-gray-600">Testing admin connection...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 p-6 rounded-lg shadow-md border border-red-200">
                        <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
                        <p className="text-red-600">{error}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Admin Config */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3">Admin Configuration</h2>
                            {results?.adminConfig ? (
                                <div className="space-y-2">
                                    {Object.entries(results.adminConfig).map(([key, value]: [string, any]) => (
                                        <div key={key} className="flex justify-between border-b pb-2">
                                            <span className="font-medium">{key}:</span>
                                            <span className={value === 'undefined' ? 'text-red-600' : 'text-green-600'}>
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-yellow-600">No admin config available</p>
                            )}
                        </div>

                        {/* Connection Test */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3">Admin Connection Test</h2>
                            {results?.adminConnection ? (
                                <div>
                                    <div className={`p-3 mb-3 rounded-lg ${results.adminConnection.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        <p className="font-semibold">Status: {results.adminConnection.success ? 'Connected' : 'Failed'}</p>
                                        {!results.adminConnection.success && (
                                            <p className="mt-1">{results.adminConnection.error}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-yellow-600">No connection data available</p>
                            )}
                        </div>

                        {/* Write Permission Test */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3">Write Permission Test</h2>
                            {results?.writePermissionTest ? (
                                <div className={`p-3 rounded-lg ${results.writePermissionTest.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    <p className="font-semibold">
                                        Status: {results.writePermissionTest.success ? 'Write Permission Confirmed' : 'Write Permission Failed'}
                                    </p>
                                    {results.writePermissionTest.error && (
                                        <p className="mt-1">{results.writePermissionTest.error}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-yellow-600">No write permission test data available</p>
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
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}