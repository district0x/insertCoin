'use client';

import { usePrivy } from '@privy-io/react-auth';

export default function PrivyLogin() {
    const { login, authenticated, user, logout } = usePrivy();

    return (
        <div className="flex flex-col items-center gap-4">
            {!authenticated ? (
                <button
                    onClick={login}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Connect Wallet
                </button>
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-gray-600">
                        Connected as: {user?.wallet?.address}
                    </p>
                    <button
                        onClick={logout}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Disconnect
                    </button>
                </div>
            )}
        </div>
    );
} 