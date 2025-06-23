'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { AuthButton } from '@/components/AuthButton';
import { usePrivy } from '@privy-io/react-auth';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import Link from 'next/link';
import { ethers } from 'ethers';
import PrivyLogin from '@/components/PrivyLogin';

export default function AdminSettings() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [multisigAddress, setMultisigAddress] = useState('');
    const [newAdminAddress, setNewAdminAddress] = useState('');

    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const { authenticated: isAuthenticated, login: signIn } = usePrivy();
    const { isAdmin: checkIsAdmin } = useTournamentContract();

    // Check if current user is admin on component mount
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!address || !isAuthenticated) {
                setIsAdmin(false);
                setIsLoading(false);
                return;
            }

            try {
                const adminStatus = await checkIsAdmin(address);
                setIsAdmin(adminStatus);
            } catch (err) {
                console.error("Error checking admin status:", err);
                setIsAdmin(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAdminStatus();
    }, [address, isAuthenticated, checkIsAdmin]);

    // Handle adding a new admin
    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ethers.utils.isAddress(newAdminAddress)) {
            setError("Please enter a valid Ethereum address");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
            // This would call the contract function, but we'll simulate for now
            // await contract.call("addAdmin", [newAdminAddress]);
            console.log(`Would add ${newAdminAddress} as admin`);

            // Simulate success
            setTimeout(() => {
                setSuccess(`Successfully added ${newAdminAddress} as an admin`);
                setNewAdminAddress('');
                setIsProcessing(false);
            }, 1000);
        } catch (err: any) {
            console.error("Error adding admin:", err);
            setError(err.message || "Failed to add admin");
            setIsProcessing(false);
        }
    };

    // Handle setting multisig address
    const handleSetMultisig = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ethers.utils.isAddress(multisigAddress)) {
            setError("Please enter a valid Ethereum address");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
            // This would call the contract function, but we'll simulate for now
            // await contract.call("setMultisigAddress", [multisigAddress]);
            console.log(`Would set multisig to ${multisigAddress}`);

            // Simulate success
            setTimeout(() => {
                setSuccess(`Successfully updated multisig address to ${multisigAddress}`);
                setIsProcessing(false);
            }, 1000);
        } catch (err: any) {
            console.error("Error setting multisig address:", err);
            setError(err.message || "Failed to set multisig address");
            setIsProcessing(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-blue-800">Admin Settings</h1>
                        <p className="text-gray-600 mt-1">Manage tournament admin configuration</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <PrivyLogin />
                        {address && <AuthButton />}
                    </div>
                </div>

                {/* Authentication Notice */}
                {!address && (
                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mb-6">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-2">Authentication Required</h2>
                        <p className="mb-4">Please connect your wallet to access the admin settings.</p>
                        <PrivyLogin />
                    </div>
                )}

                {address && !isAuthenticated && (
                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mb-6">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-2">Sign-In Required</h2>
                        <p className="mb-4">Please sign in with your wallet to verify your identity.</p>
                        <AuthButton />
                    </div>
                )}

                {isLoading && address && isAuthenticated && (
                    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mb-6">
                        <p className="text-blue-700">Checking admin privileges...</p>
                    </div>
                )}

                {!isLoading && !isAdmin && address && isAuthenticated && (
                    <div className="bg-red-50 p-6 rounded-lg border border-red-200 mb-6">
                        <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
                        <p className="mb-4">Your wallet address does not have admin privileges.</p>
                        <p className="text-sm text-red-700">
                            Only authorized admin addresses can access these settings.
                        </p>
                    </div>
                )}

                {!isLoading && isAdmin && (
                    <>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-700">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-green-700">{success}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Add Admin Form */}
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h2 className="text-xl font-semibold mb-4">Add Admin</h2>
                                <form onSubmit={handleAddAdmin}>
                                    <div className="mb-4">
                                        <label htmlFor="new-admin" className="block text-sm font-medium mb-1">
                                            New Admin Address
                                        </label>
                                        <input
                                            id="new-admin"
                                            type="text"
                                            value={newAdminAddress}
                                            onChange={(e) => setNewAdminAddress(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full p-2 border border-gray-300 rounded"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Enter the wallet address to add as an admin
                                        </p>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isProcessing}
                                        className={`w-full py-2 px-4 rounded font-medium ${isProcessing
                                            ? 'bg-gray-400 cursor-not-allowed text-white'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                    >
                                        {isProcessing ? 'Processing...' : 'Add Admin'}
                                    </button>
                                </form>
                            </div>

                            {/* Set Multisig Form */}
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h2 className="text-xl font-semibold mb-4">Set Multisig Address</h2>
                                <form onSubmit={handleSetMultisig}>
                                    <div className="mb-4">
                                        <label htmlFor="multisig-address" className="block text-sm font-medium mb-1">
                                            Multisig Address
                                        </label>
                                        <input
                                            id="multisig-address"
                                            type="text"
                                            value={multisigAddress}
                                            onChange={(e) => setMultisigAddress(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full p-2 border border-gray-300 rounded"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Update the multisig wallet address that receives platform fees
                                        </p>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isProcessing}
                                        className={`w-full py-2 px-4 rounded font-medium ${isProcessing
                                            ? 'bg-gray-400 cursor-not-allowed text-white'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                            }`}
                                    >
                                        {isProcessing ? 'Processing...' : 'Update Multisig'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Advanced Settings */}
                        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                            <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>

                            <div className="space-y-4">
                                <div className="p-3 bg-yellow-50 rounded-md">
                                    <h3 className="font-medium text-yellow-800">Remove Admin</h3>
                                    <p className="text-sm text-yellow-700 mb-2">
                                        Removing admin privileges requires careful consideration.
                                    </p>
                                    <button
                                        className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded border border-yellow-300 hover:bg-yellow-200"
                                        onClick={() => alert("This feature would be implemented in the full version")}
                                    >
                                        Manage Admins
                                    </button>
                                </div>

                                <div className="p-3 bg-red-50 rounded-md">
                                    <h3 className="font-medium text-red-800">Emergency Functions</h3>
                                    <p className="text-sm text-red-700 mb-2">
                                        These functions should only be used in case of emergency.
                                    </p>
                                    <button
                                        className="bg-red-100 text-red-800 px-3 py-1 rounded border border-red-300 hover:bg-red-200"
                                        onClick={() => alert("Emergency functions would be implemented in the full version")}
                                    >
                                        Emergency Controls
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Footer with navigation links */}
                <div className="mt-12 pt-6 border-t border-gray-200">
                    <div className="flex justify-between">
                        <Link href="/admin" className="text-blue-600 hover:text-blue-800">
                            ← Back to Admin Dashboard
                        </Link>

                        <Link href="/" className="text-blue-600 hover:text-blue-800">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}