'use client';

import { useState, useEffect } from 'react';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { WalletConnectWrapper } from '@/components/WalletConnectWrapper';
import { AuthButton } from '@/components/AuthButton';
import { useAuth } from '@/hooks/useAuth';
import { TournamentAdmin } from '@/components/TournamentAdmin';
import { TournamentErrorHandler } from '@/components/TournamentErrorBoundary';

import Link from 'next/link';

export default function AdminPage() {
    const [isLoading, setIsLoading] = useState(true);
    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const { isAuthenticated, signIn } = useAuth();

    // Set loading to false after component mounts
    useEffect(() => {
        setIsLoading(false);
    }, []);

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-blue-800">Tournament Admin Dashboard</h1>
                        <p className="text-gray-600 mt-1">Manage tournament funds and settings</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <WalletConnectWrapper />
                        {address && <AuthButton />}
                    </div>
                </div>

                {/* Authentication Notice */}
                {!address && (
                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mb-6">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-2">Authentication Required</h2>
                        <p className="mb-4">Please connect your wallet to access the admin dashboard.</p>
                        <WalletConnectWrapper />
                    </div>
                )}

                {address && !isAuthenticated && (
                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mb-6">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-2">Sign-In Required</h2>
                        <p className="mb-4">Please sign in with your wallet to verify your identity.</p>
                        <AuthButton />
                    </div>
                )}

                {address && isAuthenticated && (
                    <>
                        {/* Tournament Admin Component */}
                        <div id="tournament-admin">
                            <TournamentAdmin className="mb-6" />
                        </div>
                    </>
                )}

                {/* Footer with navigation links */}
                <div className="mt-12 pt-6 border-t border-gray-200">
                    <div className="flex justify-between">
                        <Link href="/" className="text-blue-600 hover:text-blue-800">
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}