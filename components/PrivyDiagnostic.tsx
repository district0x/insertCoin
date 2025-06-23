'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function PrivyDiagnostic() {
    const [diagnostics, setDiagnostics] = useState<any>({
        environment: {},
        browser: {},
        privy: {},
        timestamp: new Date().toISOString()
    });
    const [loginError, setLoginError] = useState<string | null>(null);
    const { login, authenticated, user } = usePrivy();

    useEffect(() => {
        // Check environment variables
        const envChecks = {
            privyAppId: !!process.env.NEXT_PUBLIC_PRIVY_APP_ID,
            privyAppIdValue: process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'NOT_SET',
            supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            contractAddress: !!process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS,
            thirdwebClientId: !!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
        };

        // Check browser environment
        const browserChecks = {
            windowDefined: typeof window !== 'undefined',
            ethereumAvailable: typeof window !== 'undefined' && !!(window as any).ethereum,
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
        };

        // Check Privy state
        const privyChecks = {
            authenticated,
            hasUser: !!user,
            hasWallet: !!user?.wallet,
            walletAddress: user?.wallet?.address || 'NONE',
            error: loginError || 'NONE',
        };

        setDiagnostics({
            environment: envChecks,
            browser: browserChecks,
            privy: privyChecks,
            timestamp: new Date().toISOString(),
        });
    }, [authenticated, user, loginError]);

    const handleTestLogin = async () => {
        try {
            setLoginError(null);
            await login();
        } catch (err: any) {
            console.error('Login test failed:', err);
            setLoginError(err.message || 'Login failed');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Privy Configuration Diagnostic</h2>

            {!diagnostics || !diagnostics.environment ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading diagnostic information...</p>
                </div>
            ) : (
                <>
                    {/* Environment Variables */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Environment Variables</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`p-3 rounded ${diagnostics.environment?.privyAppId ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <div className="font-medium">Privy App ID</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.environment?.privyAppId ? '✅ Set' : '❌ Missing'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {diagnostics.environment?.privyAppIdValue}
                                </div>
                            </div>

                            <div className={`p-3 rounded ${diagnostics.environment?.supabaseUrl ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                <div className="font-medium">Supabase URL</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.environment?.supabaseUrl ? '✅ Set' : '⚠️ Missing'}
                                </div>
                            </div>

                            <div className={`p-3 rounded ${diagnostics.environment?.supabaseKey ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                <div className="font-medium">Supabase Key</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.environment?.supabaseKey ? '✅ Set' : '⚠️ Missing'}
                                </div>
                            </div>

                            <div className={`p-3 rounded ${diagnostics.environment?.contractAddress ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                <div className="font-medium">Contract Address</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.environment?.contractAddress ? '✅ Set' : '⚠️ Missing'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Browser Environment */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Browser Environment</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`p-3 rounded ${diagnostics.browser?.windowDefined ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <div className="font-medium">Window Object</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.browser?.windowDefined ? '✅ Available' : '❌ Not Available'}
                                </div>
                            </div>

                            <div className={`p-3 rounded ${diagnostics.browser?.ethereumAvailable ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                <div className="font-medium">Ethereum Provider</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.browser?.ethereumAvailable ? '✅ Available' : '⚠️ Not Available'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Privy State */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Privy State</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`p-3 rounded ${diagnostics.privy?.authenticated ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                                <div className="font-medium">Authentication Status</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.privy?.authenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
                                </div>
                            </div>

                            <div className={`p-3 rounded ${diagnostics.privy?.hasUser ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                                <div className="font-medium">User Object</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.privy?.hasUser ? '✅ Available' : '❌ Not Available'}
                                </div>
                            </div>

                            <div className={`p-3 rounded ${diagnostics.privy?.hasWallet ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                                <div className="font-medium">Wallet</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.privy?.hasWallet ? '✅ Connected' : '❌ Not Connected'}
                                </div>
                                {diagnostics.privy?.walletAddress && (
                                    <div className="text-xs text-gray-500 mt-1 font-mono">
                                        {diagnostics.privy.walletAddress}
                                    </div>
                                )}
                            </div>

                            <div className={`p-3 rounded ${diagnostics.privy?.error === 'NONE' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <div className="font-medium">Error Status</div>
                                <div className="text-sm text-gray-600">
                                    {diagnostics.privy?.error === 'NONE' ? '✅ No Errors' : '❌ Has Error'}
                                </div>
                                {diagnostics.privy?.error !== 'NONE' && (
                                    <div className="text-xs text-red-500 mt-1">
                                        {diagnostics.privy.error}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleTestLogin}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Test Login
                        </button>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            Refresh Page
                        </button>
                    </div>

                    {/* Recommendations */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">Recommendations</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                            {!diagnostics.environment?.privyAppId && (
                                <li>• <strong>Critical:</strong> Set NEXT_PUBLIC_PRIVY_APP_ID in your environment variables</li>
                            )}
                            {!diagnostics.environment?.supabaseUrl && (
                                <li>• <strong>Important:</strong> Set NEXT_PUBLIC_SUPABASE_URL for database functionality</li>
                            )}
                            {!diagnostics.environment?.supabaseKey && (
                                <li>• <strong>Important:</strong> Set NEXT_PUBLIC_SUPABASE_ANON_KEY for database access</li>
                            )}
                            {!diagnostics.browser?.ethereumAvailable && (
                                <li>• <strong>Note:</strong> Install MetaMask or another Web3 wallet for full functionality</li>
                            )}
                            {diagnostics.privy?.error !== 'NONE' && (
                                <li>• <strong>Error:</strong> {diagnostics.privy.error}</li>
                            )}
                        </ul>
                    </div>

                    {/* Debug Info */}
                    <details className="mt-4">
                        <summary className="cursor-pointer text-sm text-gray-600 font-medium">
                            Debug Information
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                            {JSON.stringify(diagnostics, null, 2)}
                        </pre>
                    </details>
                </>
            )}
        </div>
    );
} 