'use client';

import { useState, useEffect } from 'react';
import { AuthButton } from '@/components/AuthButton';
import { usePrivy } from '@privy-io/react-auth';
import { TournamentAdmin } from '@/components/TournamentAdmin';
import { TournamentErrorHandler } from '@/components/TournamentErrorBoundary';
import PrivyLogin from '@/components/PrivyLogin';
import Link from 'next/link';

export default function AdminPage() {
    const { user } = usePrivy();
    const address = user?.wallet?.address;

    // Render a login prompt or a loading state if the address is not available
    if (!address) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Please log in to view the Admin Dashboard.</h1>
                    <PrivyLogin />
                </div>
            </div>
        );
    }

    return (
        <TournamentErrorHandler>
            <TournamentAdmin address={address} />
        </TournamentErrorHandler>
    );
}