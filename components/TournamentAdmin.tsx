// components/TournamentAdmin.tsx - WITH RATE LIMIT HANDLING
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { ethers } from 'ethers';

interface TournamentAdminProps {
    className?: string;
}

export function TournamentAdmin({ className = '' }: TournamentAdminProps) {
    const [amount, setAmount] = useState('0.01');
    const [targetTournamentId, setTargetTournamentId] = useState('');
    const [matchingPoolBalance, setMatchingPoolBalance] = useState<string>('0');
    const [isAddingFunds, setIsAddingFunds] = useState(false);
    const [isAllocatingFunds, setIsAllocatingFunds] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTournaments, setActiveTournaments] = useState<Array<{ id: string, tournamentId: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [retryAfter, setRetryAfter] = useState<number | null>(null);
    const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

    // Cache for storing tournament data with TTL
    const [tournamentCache, setTournamentCache] = useState<{
        data: any;
        timestamp: number;
    } | null>(null);

    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const {
        fillUpMatchingPool,
        allocateMatchingPoolToTournament,
        getMatchingPoolBalance,
        isAdmin: checkIsAdmin
    } = useTournamentContract();

    // Use this ref to prevent duplicate API calls during rendering
    const hasFetchedRef = useRef(false);
    const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Countdown for retry after rate limit
    useEffect(() => {
        if (retryAfter && retryAfter > 0) {
            setRetryCountdown(retryAfter);

            const countdownInterval = setInterval(() => {
                setRetryCountdown(prev => {
                    const newValue = prev !== null ? prev - 1 : null;
                    if (newValue !== null && newValue <= 0) {
                        clearInterval(countdownInterval);
                        setIsRateLimited(false);
                        setRetryAfter(null);
                        return null;
                    }
                    return newValue;
                });
            }, 1000);

            return () => clearInterval(countdownInterval);
        }
    }, [retryAfter]);

    // Check if current user is admin and get matching pool balance
    useEffect(() => {
        const fetchAdminStatusAndBalance = async () => {
            if (!address || connectionStatus !== "connected") {
                setIsAdmin(false);
                setIsLoading(false);
                return;
            }

            if (hasFetchedRef.current) return;
            hasFetchedRef.current = true;

            try {
                setIsLoading(true);

                // Check if user is admin
                const adminStatus = await checkIsAdmin(address);
                setIsAdmin(adminStatus);

                // Get matching pool balance
                const balance = await getMatchingPoolBalance();
                setMatchingPoolBalance(ethers.utils.formatEther(balance));

                // Only fetch tournaments if user is admin
                if (adminStatus) {
                    fetchTournaments();
                }
            } catch (err: any) {
                console.error("Error checking admin status:", err);
                setError(err.message || "Failed to check admin status");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAdminStatusAndBalance();

        // Reset the ref when dependencies change
        return () => {
            hasFetchedRef.current = false;
            if (requestTimeoutRef.current) {
                clearTimeout(requestTimeoutRef.current);
            }
        };
    }, [address, connectionStatus, checkIsAdmin, getMatchingPoolBalance]);

    // Simplified fetch tournament function with better rate limit handling
    const fetchTournaments = async (forceRefresh = false) => {
        // If we're rate limited and waiting for retry, use cached data if available
        if (isRateLimited && retryAfter !== null && retryAfter > 0) {
            if (tournamentCache?.data?.tournaments) {
                console.log("Rate limited, using cached data");
                setActiveTournaments(tournamentCache.data.tournaments.map((t: any) => ({
                    id: t.id || `temp-${Date.now()}`,
                    tournamentId: t.tournamentId?.toString() || ''
                })));
                return;
            }
            return;
        }

        try {
            // Check if we have cached data and it's less than a minute old
            if (!forceRefresh && tournamentCache && (Date.now() - tournamentCache.timestamp < 60000)) {
                console.log("Using cached tournament data");
                if (tournamentCache.data?.tournaments) {
                    setActiveTournaments(tournamentCache.data.tournaments.map((t: any) => ({
                        id: t.id || `temp-${Date.now()}`,
                        tournamentId: t.tournamentId?.toString() || ''
                    })));
                    return;
                }
            }

            // Add delay between requests to avoid rate limiting
            if (requestTimeoutRef.current) {
                clearTimeout(requestTimeoutRef.current);
            }

            // Use standard browser fetch API
            console.log("Fetching tournament data from API");
            const response = await fetch('/api/tournament', {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (!response.ok) {
                // Handle rate limiting from the server
                if (response.status === 429) {
                    setIsRateLimited(true);
                    const retryValue = response.headers.get('Retry-After');
                    const retrySeconds = retryValue ? parseInt(retryValue) : 15; // Default to 15 seconds

                    console.log(`Rate limited. Retry after ${retrySeconds} seconds.`);
                    setRetryAfter(retrySeconds);

                    // If we have cached data, use it even if it's old
                    if (tournamentCache?.data?.tournaments) {
                        console.log("Using cached data due to rate limiting");
                        setActiveTournaments(tournamentCache.data.tournaments.map((t: any) => ({
                            id: t.id || `temp-${Date.now()}`,
                            tournamentId: t.tournamentId?.toString() || ''
                        })));
                    }

                    return;
                }
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the response
            setTournamentCache({
                data,
                timestamp: Date.now()
            });

            if (data?.tournaments) {
                setActiveTournaments(data.tournaments.map((t: any) => ({
                    id: t.id || `temp-${Date.now()}`,
                    tournamentId: t.tournamentId?.toString() || ''
                })));
            }
        } catch (err: any) {
            console.error("Error fetching tournaments:", err);
            // Only show the error to the user if it's not a rate limit error
            if (!isRateLimited) {
                setError(err.message || "Failed to fetch tournaments");
            }
        }
    };

    // Handle adding funds to matching pool
    const handleAddFunds = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!address || connectionStatus !== "connected") {
            setError("Please connect your wallet first");
            return;
        }

        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            setError("Please enter a valid amount");
            return;
        }

        setIsAddingFunds(true);
        setError(null);
        setSuccess(null);

        try {
            // Convert amount to wei
            const amountInWei = ethers.utils.parseEther(amount);

            const tx = await fillUpMatchingPool(amountInWei);
            console.log("Transaction successful:", tx);

            // Update matching pool balance
            const newBalance = await getMatchingPoolBalance();
            setMatchingPoolBalance(ethers.utils.formatEther(newBalance));

            setSuccess(`Successfully added ${amount} ETH to the matching pool`);
            setAmount('0.01'); // Reset amount
        } catch (err: any) {
            console.error("Transaction failed:", err);
            setError(err.message || "Transaction failed");
        } finally {
            setIsAddingFunds(false);
        }
    };

    // Handle allocating funds to tournament
    const handleAllocateFunds = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!address || connectionStatus !== "connected") {
            setError("Please connect your wallet first");
            return;
        }

        if (!targetTournamentId) {
            setError("Please select a tournament");
            return;
        }

        setIsAllocatingFunds(true);
        setError(null);
        setSuccess(null);

        try {
            const tx = await allocateMatchingPoolToTournament(parseInt(targetTournamentId));
            console.log("Allocation transaction submitted:", tx);

            // Update matching pool balance after allocation
            const newBalance = await getMatchingPoolBalance();
            setMatchingPoolBalance(ethers.utils.formatEther(newBalance));

            setSuccess(`Successfully allocated funds to tournament #${targetTournamentId}`);
            setTargetTournamentId(''); // Reset tournament ID
        } catch (err: any) {
            console.error("Transaction failed:", err);
            setError(err.message || "Transaction failed");
        } finally {
            setIsAllocatingFunds(false);
        }
    };

    // Handle manual refresh
    const handleManualRefresh = async () => {
        // Don't allow refresh if rate limited
        if (isRateLimited && retryAfter !== null && retryAfter > 0) {
            setError(`Rate limited. Please wait ${retryCountdown || retryAfter} seconds before refreshing.`);
            return;
        }

        setIsRefreshing(true);
        setError(null);

        try {
            // Get matching pool balance
            const balance = await getMatchingPoolBalance();
            setMatchingPoolBalance(ethers.utils.formatEther(balance));

            // Fetch tournaments with forced refresh
            await fetchTournaments(true);
        } catch (err: any) {
            console.error("Error refreshing data:", err);
            setError(err.message || "Failed to refresh data");
        } finally {
            setIsRefreshing(false);
        }
    };

    // Format ETH amounts for display
    const formatEth = (amount: string) => {
        return parseFloat(amount).toFixed(4) + ' ETH';
    };

    // Admin section will only show if not loading and user is admin
    return (
        <div className={`bg-white p-6 rounded-lg shadow-md ${className}`}>
            <h2 className="text-2xl font-bold mb-4">Tournament Fund Management</h2>

            {isLoading ? (
                <div className="text-center p-4">
                    <p>Loading admin status...</p>
                </div>
            ) : !address || connectionStatus !== "connected" ? (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-yellow-700">Please connect your wallet to access admin functions.</p>
                </div>
            ) : !isAdmin ? (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-red-700">You don't have admin privileges to manage tournament funds.</p>
                </div>
            ) : (
                <>
                    {isRateLimited && retryCountdown !== null && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-yellow-700">
                                Rate limit reached. Retry in {retryCountdown} seconds.
                            </p>
                            {tournamentCache && (
                                <p className="text-sm text-yellow-600 mt-1">
                                    Using cached data from {new Date(tournamentCache.timestamp).toLocaleTimeString()}.
                                </p>
                            )}
                        </div>
                    )}

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

                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">Current Matching Pool:</span>
                            <span className="text-xl font-bold text-green-700">{formatEth(matchingPoolBalance)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Add Funds Section */}
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-semibold mb-3">Add Funds to Matching Pool</h3>
                            <form onSubmit={handleAddFunds}>
                                <div className="mb-4">
                                    <label htmlFor="amount" className="block text-sm font-medium mb-1">
                                        Amount (ETH)
                                    </label>
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isAddingFunds}
                                    className={`w-full py-2 px-4 rounded font-medium ${isAddingFunds
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                >
                                    {isAddingFunds ? 'Processing...' : 'Add Funds'}
                                </button>
                            </form>
                        </div>

                        {/* Allocate Funds Section */}
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-semibold mb-3">Allocate Funds to Tournament</h3>
                            <form onSubmit={handleAllocateFunds}>
                                <div className="mb-4">
                                    <label htmlFor="tournament-id" className="block text-sm font-medium mb-1">
                                        Tournament ID
                                    </label>
                                    {activeTournaments.length > 0 ? (
                                        <select
                                            id="tournament-id"
                                            value={targetTournamentId}
                                            onChange={(e) => setTargetTournamentId(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded"
                                            required
                                        >
                                            <option value="">Select a tournament</option>
                                            {activeTournaments.map((tournament) => (
                                                <option key={tournament.id} value={tournament.tournamentId}>
                                                    Tournament #{tournament.tournamentId}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            id="tournament-id"
                                            type="text"
                                            value={targetTournamentId}
                                            onChange={(e) => setTargetTournamentId(e.target.value)}
                                            placeholder="Enter tournament ID"
                                            className="w-full p-2 border border-gray-300 rounded"
                                            required
                                        />
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={isAllocatingFunds || !targetTournamentId || parseFloat(matchingPoolBalance) <= 0}
                                    className={`w-full py-2 px-4 rounded font-medium ${isAllocatingFunds || !targetTournamentId || parseFloat(matchingPoolBalance) <= 0
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {isAllocatingFunds ? 'Processing...' : 'Allocate Funds'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-semibold">Active Tournaments</h3>
                            <button
                                onClick={handleManualRefresh}
                                disabled={isRefreshing || (isRateLimited && retryCountdown !== null && retryCountdown > 0)}
                                className="px-3 py-1 bg-blue-50 text-blue-600 rounded border border-blue-200 text-sm hover:bg-blue-100 disabled:opacity-50 disabled:hover:bg-blue-50"
                            >
                                {isRefreshing ? 'Refreshing...' :
                                    isRateLimited && retryCountdown !== null ?
                                        `Retry in ${retryCountdown}s` : 'Refresh Data'}
                            </button>
                        </div>

                        {activeTournaments.length > 0 ? (
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {activeTournaments.map((tournament) => (
                                            <tr key={tournament.id}>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <span className="font-medium">{tournament.tournamentId}</span>
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">Active</td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            setTargetTournamentId(tournament.tournamentId);
                                                            // Scroll to allocation form
                                                            document.getElementById('tournament-id')?.scrollIntoView({ behavior: 'smooth' });
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800"
                                                    >
                                                        Select
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                                <p className="text-gray-500">No active tournaments found.</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Create a tournament from the home page or check your connection.
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}