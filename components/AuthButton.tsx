'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function AuthButton() {
    const { authenticated: isAuthenticated, login: signIn, logout: signOut, isLoading, error } = usePrivy();
    const [authLoading, setAuthLoading] = useState(false);

    const handleAuth = async () => {
        if (isAuthenticated) {
            await signOut();
        } else {
            setAuthLoading(true);
            await signIn();
            setAuthLoading(false);
        }
    };

    return (
        <div>
            <button
                onClick={handleAuth}
                disabled={isLoading || authLoading}
                className={`px-4 py-2 rounded-lg text-white font-medium ${isAuthenticated
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                    } disabled:opacity-50`}
            >
                {isLoading || authLoading
                    ? 'Loading...'
                    : isAuthenticated
                        ? 'Sign Out'
                        : 'Sign In with Wallet'}
            </button>

            {error && (
                <div className="text-red-500 text-sm mt-1">{error}</div>
            )}
        </div>
    );
}