// components/TournamentAdmin.tsx - WITH RATE LIMIT HANDLING
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { ethers } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';

interface TournamentAdminProps {
    className?: string;
    address: string;
}

export function TournamentAdmin({ className = '', address }: TournamentAdminProps) {
    const [amount, setAmount] = useState('0.01');
    const [targetTournamentId, setTargetTournamentId] = useState('');
    const [matchingPoolBalance, setMatchingPoolBalance] = useState<string>('0');
    const [isAddingFunds, setIsAddingFunds] = useState(false);
    const [isAllocatingFunds, setIsAllocatingFunds] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTournaments, setActiveTournaments] = useState<Array<{
        id: string;
        tournamentId: string;
        roomCode?: string;
        status?: string;
        currentParticipants?: number;
        maxParticipants?: number;
        totalPrize?: number;
        entryFeeFormatted?: string;
        winners?: Array<{
            name: string;
            address: string;
            rank: number;
            actualPayout?: string;
            hasClaimed?: boolean;
            payoutFormatted?: string;
        }>;
    }>>([]);
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

    // Smart Contract Management States
    const [adminAddress, setAdminAddress] = useState('');
    const [blacklistAddress, setBlacklistAddress] = useState('');
    const [tokenAddress, setTokenAddress] = useState('');
    const [tokenApproved, setTokenApproved] = useState(true);
    const [newMultisigAddress, setNewMultisigAddress] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('0.01');
    const [isManagingAdmins, setIsManagingAdmins] = useState(false);
    const [isManagingBlacklist, setIsManagingBlacklist] = useState(false);
    const [isManagingTokens, setIsManagingTokens] = useState(false);
    const [isManagingMultisig, setIsManagingMultisig] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // ETH Price for USD conversion
    const [ethPrice, setEthPrice] = useState<number | null>(null);
    const [isLoadingEthPrice, setIsLoadingEthPrice] = useState(false);
    const [ethPriceCache, setEthPriceCache] = useState<{ price: number; timestamp: number } | null>(null);

    // Token Information
    const [tokenInfo, setTokenInfo] = useState<{
        name: string;
        symbol: string;
        decimals: number;
        totalSupply: string;
    } | null>(null);
    const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);

    // Approved Tokens Management (Supabase)
    const [approvedTokens, setApprovedTokens] = useState<Array<{
        id: number;
        address: string;
        name: string;
        symbol: string;
        decimals: number;
        total_supply: string;
        is_native: boolean;
        is_approved: boolean;
        created_at: string;
        updated_at: string;
    }>>([]);
    const [isLoadingApprovedTokens, setIsLoadingApprovedTokens] = useState(false);
    const [newTokenAddress, setNewTokenAddress] = useState('');
    const [newTokenName, setNewTokenName] = useState('');
    const [newTokenSymbol, setNewTokenSymbol] = useState('');
    const [newTokenDecimals, setNewTokenDecimals] = useState('18');
    const [isAddingToken, setIsAddingToken] = useState(false);
    const [isUpdatingToken, setIsUpdatingToken] = useState(false);

    const {
        fillUpMatchingPool,
        allocateMatchingPoolToTournament,
        getMatchingPoolBalance,
        isAdmin: checkIsAdmin,
        getTournamentWinnerData,
        addAdmin,
        removeAdmin,
        addBlacklisted,
        removeBlacklisted,
        approveToken,
        setMultisigAddress,
        withdrawFunds
    } = useTournamentContract();

    const { logout } = usePrivy();

    // Refs for tracking state
    const hasFetchedRef = useRef(false);
    const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasFetchedTournamentsRef = useRef(false);
    const hasFetchedEthPriceRef = useRef(false);

    // Enhanced fetch tournament function with blockchain data
    const fetchTournaments = useCallback(async (forceRefresh = false) => {
        // Don't fetch if not admin, already loading, or rate limited (unless forced)
        if (!isAdmin || ((isLoading || isRateLimited) && !forceRefresh)) {
            return;
        }

        console.log('Fetching tournament data from API and blockchain');
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/tournament', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const retryAfterSeconds = retryAfter ? parseInt(retryAfter) : 60;

                setIsRateLimited(true);
                setRetryAfter(retryAfterSeconds);
                setRetryCountdown(retryAfterSeconds);

                // Start countdown timer
                const countdownInterval = setInterval(() => {
                    setRetryCountdown(prev => {
                        if (prev && prev > 1) {
                            return prev - 1;
                        } else {
                            clearInterval(countdownInterval);
                            setIsRateLimited(false);
                            setRetryAfter(null);
                            setRetryCountdown(null);
                            return null;
                        }
                    });
                }, 1000);

                setError(`Rate limit reached. Please wait ${retryAfterSeconds} seconds before trying again.`);
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.tournaments) {
                // Enhance tournaments with blockchain data
                const enhancedTournaments = await Promise.all(
                    data.tournaments.map(async (tournament: any) => {
                        if (tournament.status === 'COMPLETED' && tournament.winners) {
                            try {
                                // Fetch actual payout amounts from blockchain
                                const enhancedWinners = await Promise.all(
                                    tournament.winners.map(async (winner: any) => {
                                        try {
                                            // Get actual payout amount from smart contract
                                            const winnerData = await getTournamentWinnerData(
                                                parseInt(tournament.tournamentId),
                                                winner.address
                                            );

                                            return {
                                                ...winner,
                                                actualPayout: winnerData?.amount || '0',
                                                hasClaimed: winnerData?.hasClaimed || false,
                                                payoutFormatted: winnerData?.amount ? ethers.utils.formatEther(winnerData.amount) : '0'
                                            };
                                        } catch (err) {
                                            console.error(`Error fetching winner data for ${winner.address}:`, err);
                                            return {
                                                ...winner,
                                                actualPayout: '0',
                                                hasClaimed: false,
                                                payoutFormatted: '0'
                                            };
                                        }
                                    })
                                );

                                return {
                                    ...tournament,
                                    winners: enhancedWinners
                                };
                            } catch (err) {
                                console.error(`Error enhancing tournament ${tournament.tournamentId}:`, err);
                                return tournament;
                            }
                        }
                        return tournament;
                    })
                );

                setActiveTournaments(enhancedTournaments.map((t: any) => ({
                    id: t.id || `temp-${Date.now()}`,
                    tournamentId: t.tournamentId?.toString() || '',
                    roomCode: t.roomCode,
                    status: t.status,
                    currentParticipants: t.currentParticipants,
                    maxParticipants: t.maxParticipants,
                    totalPrize: t.totalPrize,
                    entryFeeFormatted: t.entryFeeFormatted,
                    winners: t.winners
                })));

                // Cache the data with timestamp
                setTournamentCache({
                    data: enhancedTournaments,
                    timestamp: Date.now()
                });
            }
        } catch (err: any) {
            console.error('Error fetching tournaments:', err);

            // If we have cached data, use it and show a warning
            if (tournamentCache && tournamentCache.data) {
                setActiveTournaments(tournamentCache.data);
                setError(`Failed to fetch fresh data. Using cached data from ${new Date(tournamentCache.timestamp).toLocaleTimeString()}. Error: ${err.message}`);
            } else {
                setError(`Failed to fetch tournaments: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isAdmin, isLoading, isRateLimited, tournamentCache]);

    // Function to fetch ETH price
    const fetchEthPrice = useCallback(async () => {
        if (isLoadingEthPrice || hasFetchedEthPriceRef.current) return;

        // Check cache first (5 minute cache)
        const now = Date.now();
        const cacheExpiry = 5 * 60 * 1000; // 5 minutes

        if (ethPriceCache && (now - ethPriceCache.timestamp) < cacheExpiry) {
            setEthPrice(ethPriceCache.price);
            hasFetchedEthPriceRef.current = true;
            return;
        }

        hasFetchedEthPriceRef.current = true;
        setIsLoadingEthPrice(true);
        try {
            const response = await fetch('/api/eth-price');
            if (response.ok) {
                const data = await response.json();
                const price = data.price;
                setEthPrice(price);
                setEthPriceCache({ price, timestamp: now });
            }
        } catch (error) {
            console.error('Error fetching ETH price:', error);
        } finally {
            setIsLoadingEthPrice(false);
        }
    }, [isLoadingEthPrice, ethPriceCache]);

    // Function to fetch token information
    const fetchTokenInfo = useCallback(async (tokenAddress: string) => {
        if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
            setTokenInfo(null);
            return;
        }

        setIsLoadingTokenInfo(true);
        try {
            // Basic ERC-20 ABI for token info
            const tokenABI = [
                "function name() view returns (string)",
                "function symbol() view returns (string)",
                "function decimals() view returns (uint8)",
                "function totalSupply() view returns (uint256)"
            ];

            const provider = new ethers.providers.Web3Provider((window as any).ethereum);
            const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);

            const [name, symbol, decimals, totalSupply] = await Promise.all([
                tokenContract.name(),
                tokenContract.symbol(),
                tokenContract.decimals(),
                tokenContract.totalSupply()
            ]);

            setTokenInfo({
                name,
                symbol,
                decimals,
                totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
            });
        } catch (error) {
            console.error('Error fetching token info:', error);
            setTokenInfo(null);
        } finally {
            setIsLoadingTokenInfo(false);
        }
    }, []);

    // Fetch admin status and balance function
    const fetchAdminStatusAndBalance = useCallback(async () => {
        if (!address) {
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
            setMatchingPoolBalance(balance);

            // Fetch ETH price when admin status is confirmed
            if (adminStatus) {
                fetchEthPrice();
            }

            // Only fetch tournaments if user is admin
            if (adminStatus) {
                // Tournament fetching is handled in a separate useEffect
            }
        } catch (err: any) {
            console.error("Error checking admin status:", err);
            setError(err.message || "Failed to check admin status");
        } finally {
            setIsLoading(false);
        }
    }, [address, checkIsAdmin, getMatchingPoolBalance, fetchEthPrice]);

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
        fetchAdminStatusAndBalance();

        // Reset the ref when dependencies change
        return () => {
            hasFetchedRef.current = false;
            if (requestTimeoutRef.current) {
                clearTimeout(requestTimeoutRef.current);
            }
        };
    }, [fetchAdminStatusAndBalance]);

    // Fetch tournaments when user becomes admin
    useEffect(() => {
        if (isAdmin && !isLoading && !hasFetchedTournamentsRef.current) {
            // Use a timeout to avoid immediate calls and potential race conditions
            const timeoutId = setTimeout(() => {
                hasFetchedTournamentsRef.current = true;
                fetchTournaments();
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [isAdmin, isLoading]); // Removed fetchTournaments from dependencies

    // Cleanup effect to reset fetch flags when admin status changes
    useEffect(() => {
        return () => {
            hasFetchedRef.current = false;
            hasFetchedTournamentsRef.current = false;
            if (requestTimeoutRef.current) {
                clearTimeout(requestTimeoutRef.current);
            }
        };
    }, [isAdmin]);

    // Fetch token information when token address changes
    useEffect(() => {
        if (tokenAddress) {
            fetchTokenInfo(tokenAddress);
        } else {
            setTokenInfo(null);
        }
    }, [tokenAddress, fetchTokenInfo]);

    // Fetch ETH price on component mount
    useEffect(() => {
        if (!hasFetchedEthPriceRef.current) {
            fetchEthPrice();
            hasFetchedEthPriceRef.current = true;
        }
    }, []);

    // Fetch approved tokens on component mount
    useEffect(() => {
        if (isAdmin) {
            fetchApprovedTokens();
        }
    }, [isAdmin]);

    // Handle adding funds to matching pool
    const handleAddFunds = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!address) {
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
            setMatchingPoolBalance(newBalance);

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

        if (!address) {
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
            setMatchingPoolBalance(newBalance);

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
            // Reset the fetch flag to allow fresh data
            hasFetchedTournamentsRef.current = false;
            await fetchTournaments(true);
            setSuccess('Tournament data refreshed successfully');
        } catch (err: any) {
            setError(`Failed to refresh: ${err.message}`);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Handle manual tournament status update
    const [manualTournamentId, setManualTournamentId] = useState('');
    const [manualStatus, setManualStatus] = useState('COMPLETED');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const handleUpdateTournamentStatus = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!manualTournamentId) {
            setError('Please enter a tournament ID');
            return;
        }

        setIsUpdatingStatus(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/tournament/update-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tournamentId: manualTournamentId,
                    status: manualStatus
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update tournament status');
            }

            setSuccess(`Tournament ${manualTournamentId} status updated to ${manualStatus}`);
            setManualTournamentId('');

            // Refresh tournament data
            hasFetchedTournamentsRef.current = false;
            await fetchTournaments(true);
        } catch (err: any) {
            setError(`Failed to update tournament status: ${err.message}`);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // Handle blockchain event processing for specific tournament
    const [isProcessingEvents, setIsProcessingEvents] = useState(false);

    const handleProcessTournamentEvents = async () => {
        if (!manualTournamentId) {
            setError('Please enter a tournament ID first');
            return;
        }

        setIsProcessingEvents(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/blockchain-events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'process_tournament',
                    tournamentId: manualTournamentId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process blockchain events');
            }

            if (data.success) {
                setSuccess(data.message);
                // Refresh tournament data
                hasFetchedTournamentsRef.current = false;
                await fetchTournaments(true);
            } else {
                setError(data.message || 'No events found for this tournament');
            }
        } catch (err: any) {
            setError(`Failed to process blockchain events: ${err.message}`);
        } finally {
            setIsProcessingEvents(false);
        }
    };

    // Format ETH amounts for display
    const formatEth = (amount: string) => {
        return parseFloat(amount).toFixed(4) + ' ETH';
    };

    // Calculate winner payout based on rank and total prize
    const calculateWinnerPayout = (rank: number, totalPrize: number, winnerCount: number) => {
        if (winnerCount === 1) return totalPrize;
        if (winnerCount === 2) {
            return rank === 1 ? totalPrize * 0.7 : totalPrize * 0.3;
        }
        if (winnerCount === 3) {
            if (rank === 1) return totalPrize * 0.6;
            if (rank === 2) return totalPrize * 0.3;
            return totalPrize * 0.1;
        }
        // For more than 3 winners, use a declining scale
        const firstPlace = Math.max(0.4, 1 - (winnerCount - 1) * 0.15);
        if (rank === 1) return totalPrize * firstPlace;
        if (rank === 2) return totalPrize * (1 - firstPlace) * 0.6;
        if (rank === 3) return totalPrize * (1 - firstPlace) * 0.4;
        return totalPrize * 0.05; // Minimum 5% for other winners
    };

    // Smart Contract Management Handlers
    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminAddress || !ethers.utils.isAddress(adminAddress)) {
            setError("Please enter a valid admin address");
            return;
        }

        setIsManagingAdmins(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await addAdmin(adminAddress);
            setSuccess(`Admin ${adminAddress} added successfully! TX: ${result.hash}`);
            setAdminAddress('');
        } catch (err: any) {
            console.error("Error adding admin:", err);
            setError(err.message || "Failed to add admin");
        } finally {
            setIsManagingAdmins(false);
        }
    };

    const handleRemoveAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminAddress || !ethers.utils.isAddress(adminAddress)) {
            setError("Please enter a valid admin address");
            return;
        }

        setIsManagingAdmins(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await removeAdmin(adminAddress);
            setSuccess(`Admin ${adminAddress} removed successfully! TX: ${result.hash}`);
            setAdminAddress('');
        } catch (err: any) {
            console.error("Error removing admin:", err);
            setError(err.message || "Failed to remove admin");
        } finally {
            setIsManagingAdmins(false);
        }
    };

    const handleAddBlacklisted = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!blacklistAddress || !ethers.utils.isAddress(blacklistAddress)) {
            setError("Please enter a valid address");
            return;
        }

        setIsManagingBlacklist(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await addBlacklisted(blacklistAddress);
            setSuccess(`Address ${blacklistAddress} blacklisted successfully! TX: ${result.hash}`);
            setBlacklistAddress('');
        } catch (err: any) {
            console.error("Error blacklisting address:", err);
            setError(err.message || "Failed to blacklist address");
        } finally {
            setIsManagingBlacklist(false);
        }
    };

    const handleRemoveBlacklisted = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!blacklistAddress || !ethers.utils.isAddress(blacklistAddress)) {
            setError("Please enter a valid address");
            return;
        }

        setIsManagingBlacklist(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await removeBlacklisted(blacklistAddress);
            setSuccess(`Address ${blacklistAddress} removed from blacklist successfully! TX: ${result.hash}`);
            setBlacklistAddress('');
        } catch (err: any) {
            console.error("Error removing from blacklist:", err);
            setError(err.message || "Failed to remove from blacklist");
        } finally {
            setIsManagingBlacklist(false);
        }
    };

    const handleApproveToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
            setError("Please enter a valid token address");
            return;
        }

        setIsManagingTokens(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await approveToken(tokenAddress, tokenApproved);
            setSuccess(`Token ${tokenAddress} ${tokenApproved ? 'approved' : 'disapproved'} successfully! TX: ${result.hash}`);
            setTokenAddress('');
        } catch (err: any) {
            console.error("Error updating token approval:", err);
            setError(err.message || "Failed to update token approval");
        } finally {
            setIsManagingTokens(false);
        }
    };

    const handleSetMultisigAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMultisigAddress || !ethers.utils.isAddress(newMultisigAddress)) {
            setError("Please enter a valid multisig address");
            return;
        }

        setIsManagingMultisig(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await setMultisigAddress(newMultisigAddress);
            setSuccess(`Multisig address updated to ${newMultisigAddress} successfully! TX: ${result.hash}`);
            setNewMultisigAddress('');
        } catch (err: any) {
            console.error("Error updating multisig address:", err);
            setError(err.message || "Failed to update multisig address");
        } finally {
            setIsManagingMultisig(false);
        }
    };

    const handleWithdrawFunds = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsWithdrawing(true);
            setError(null);
            const amountInWei = ethers.utils.parseEther(withdrawAmount);
            await withdrawFunds(amountInWei);
            setSuccess(`Successfully withdrew ${withdrawAmount} ETH`);
            setWithdrawAmount('0.01');
        } catch (err: any) {
            setError(err.message || "Failed to withdraw funds");
        } finally {
            setIsWithdrawing(false);
        }
    };

    // Approved Tokens Management Functions
    const fetchApprovedTokens = async () => {
        try {
            setIsLoadingApprovedTokens(true);
            const response = await fetch('/api/admin/approved-tokens');
            if (response.ok) {
                const data = await response.json();
                setApprovedTokens(data.tokens || []);
            } else {
                throw new Error('Failed to fetch approved tokens');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch approved tokens');
        } finally {
            setIsLoadingApprovedTokens(false);
        }
    };

    const handleAddToken = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsAddingToken(true);
            setError(null);

            const response = await fetch('/api/admin/approved-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: newTokenAddress,
                    name: newTokenName,
                    symbol: newTokenSymbol,
                    decimals: parseInt(newTokenDecimals),
                    totalSupply: '0',
                    isNative: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSuccess(data.message || 'Token added successfully');
                // Reset form
                setNewTokenAddress('');
                setNewTokenName('');
                setNewTokenSymbol('');
                setNewTokenDecimals('18');
                // Refresh the list
                await fetchApprovedTokens();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add token');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to add token');
        } finally {
            setIsAddingToken(false);
        }
    };

    const handleUpdateTokenApproval = async (address: string, isApproved: boolean) => {
        try {
            setIsUpdatingToken(true);
            setError(null);

            const response = await fetch('/api/admin/approved-tokens', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, isApproved })
            });

            if (response.ok) {
                const data = await response.json();
                setSuccess(data.message || 'Token approval updated successfully');
                // Refresh the list
                await fetchApprovedTokens();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update token approval');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to update token approval');
        } finally {
            setIsUpdatingToken(false);
        }
    };

    const handleDeleteToken = async (address: string) => {
        if (!confirm('Are you sure you want to delete this token?')) {
            return;
        }

        try {
            setIsUpdatingToken(true);
            setError(null);

            const response = await fetch(`/api/admin/approved-tokens?address=${address}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const data = await response.json();
                setSuccess(data.message || 'Token deleted successfully');
                // Refresh the list
                await fetchApprovedTokens();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete token');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to delete token');
        } finally {
            setIsUpdatingToken(false);
        }
    };

    // Admin section will only show if not loading and user is admin
    return (
        <div className={`bg-black min-h-screen h-screen flex text-white ${className}`}>
            {/* Left Sidebar for Wallet Info */}
            <div className="w-64 flex-shrink-0 bg-black p-4 flex flex-col justify-between border-r border-gray-800">
                <div>
                    <h1 className="text-lg font-bold text-white mb-8">Trivia Game Admin</h1>

                    <button
                        onClick={logout}
                        className="w-full text-left py-2 px-3 rounded font-medium transition-colors text-sm bg-red-600 text-white hover:bg-red-700 mb-4"
                    >
                        Sign Out
                    </button>

                    {address && (
                        <div className="space-y-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-blue-100">
                                Privy Wallet
                            </span>
                            <p className="text-sm text-gray-400 font-mono break-all">{address}</p>
                        </div>
                    )}
                </div>

                <div className="text-xs text-gray-500">
                    <p className="font-semibold">Contract Address</p>
                    <p className="font-mono break-all">
                        {process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS}
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex-shrink-0">
                        <h2 className="text-white text-2xl font-bold uppercase tracking-wide">Tournament Fund Management</h2>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-auto p-4">
                        <div className="max-w-none mx-auto">
                            {isLoading ? (
                                <div className="text-center p-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                                    <p className="text-gray-300">Loading admin status...</p>
                                </div>
                            ) : !address ? (
                                <div className="text-center p-8">
                                    <p className="text-lg text-yellow-400">Please connect your wallet to access the admin dashboard.</p>
                                </div>
                            ) : !isAdmin ? (
                                <div className="text-center p-8">
                                    <p className="text-lg text-red-400">You do not have permission to access this page.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    {/* Left Column */}
                                    <div className="lg:col-span-3">
                                        {error && (
                                            <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded-lg relative mb-4" role="alert">
                                                <strong className="font-bold">Error: </strong>
                                                <span className="block sm:inline">{error}</span>
                                            </div>
                                        )}
                                        {success && (
                                            <div className="bg-green-800 border border-green-600 text-white px-4 py-3 rounded-lg relative mb-4" role="alert">
                                                <strong className="font-bold">Success: </strong>
                                                <span className="block sm:inline">{success}</span>
                                            </div>
                                        )}

                                        {/* Matching Pool Balance */}
                                        <div className="bg-gray-900 rounded-lg p-3 mb-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-300 text-sm font-medium">Current Matching Pool:</span>
                                                <div className="text-right">
                                                    <div className="text-green-400 text-lg font-bold">{matchingPoolBalance} ETH</div>
                                                    {isLoadingEthPrice ? (
                                                        <div className="text-gray-500 text-xs">Loading USD...</div>
                                                    ) : ethPrice ? (
                                                        <div className="text-gray-400 text-sm">
                                                            ${(parseFloat(matchingPoolBalance) * ethPrice).toFixed(2)} USD
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-500 text-xs">USD unavailable</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Smart Contract Management Section */}
                                        <div className="bg-gray-900 rounded-lg p-4 mb-4">
                                            <h3 className="text-white text-lg font-semibold mb-3">Smart Contract Management</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                                {/* Add Funds to Matching Pool */}
                                                <div className="bg-gray-800 rounded-lg p-3">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Add Funds to Matching Pool</h4>
                                                    <form onSubmit={handleAddFunds} className="space-y-2">
                                                        <div>
                                                            <label className="block text-gray-300 text-xs mb-1">Amount (ETH)</label>
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                min="0.001"
                                                                value={amount}
                                                                onChange={(e) => setAmount(e.target.value)}
                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                                                placeholder="0.01"
                                                                required
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={isAddingFunds}
                                                            className={`w-full py-2 px-3 rounded font-medium transition-colors text-sm ${isAddingFunds
                                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                : 'bg-green-600 text-white hover:bg-green-700'
                                                                }`}
                                                        >
                                                            {isAddingFunds ? 'Adding Funds...' : 'Add Funds'}
                                                        </button>
                                                    </form>
                                                </div>

                                                {/* Allocate Funds to Tournament */}
                                                <div className="bg-gray-800 rounded-lg p-3">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Allocate Funds to Tournament</h4>
                                                    <form onSubmit={handleAllocateFunds} className="space-y-2">
                                                        <div>
                                                            <label className="block text-gray-300 text-xs mb-1">Tournament ID</label>
                                                            <input
                                                                type="number"
                                                                value={targetTournamentId}
                                                                onChange={(e) => setTargetTournamentId(e.target.value)}
                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                                                placeholder="Enter tournament ID"
                                                                required
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={isAllocatingFunds}
                                                            className={`w-full py-2 px-3 rounded font-medium transition-colors text-sm ${isAllocatingFunds
                                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                                                }`}
                                                        >
                                                            {isAllocatingFunds ? 'Allocating...' : 'Allocate Funds'}
                                                        </button>
                                                    </form>
                                                </div>

                                                {/* Admin Management */}
                                                <div className="bg-gray-800 rounded-lg p-3">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Admin Management</h4>
                                                    <form onSubmit={handleAddAdmin} className="space-y-2 mb-3">
                                                        <div>
                                                            <label className="block text-gray-300 text-xs mb-1">Admin Address</label>
                                                            <input
                                                                type="text"
                                                                value={adminAddress}
                                                                onChange={(e) => setAdminAddress(e.target.value)}
                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                                                placeholder="0x..."
                                                                required
                                                            />
                                                        </div>
                                                        <div className="flex space-x-1">
                                                            <button
                                                                type="submit"
                                                                disabled={isManagingAdmins}
                                                                className={`flex-1 py-1 px-2 rounded font-medium transition-colors text-xs ${isManagingAdmins
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                                    }`}
                                                            >
                                                                {isManagingAdmins ? 'Adding...' : 'Add Admin'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleRemoveAdmin}
                                                                disabled={isManagingAdmins}
                                                                className={`flex-1 py-1 px-2 rounded font-medium transition-colors text-xs ${isManagingAdmins
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-red-600 text-white hover:bg-red-700'
                                                                    }`}
                                                            >
                                                                {isManagingAdmins ? 'Removing...' : 'Remove Admin'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>

                                                {/* Blacklist Management */}
                                                <div className="bg-gray-800 rounded-lg p-3">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Blacklist Management</h4>
                                                    <form onSubmit={handleAddBlacklisted} className="space-y-2 mb-3">
                                                        <div>
                                                            <label className="block text-gray-300 text-xs mb-1">Address</label>
                                                            <input
                                                                type="text"
                                                                value={blacklistAddress}
                                                                onChange={(e) => setBlacklistAddress(e.target.value)}
                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                                                placeholder="0x..."
                                                                required
                                                            />
                                                        </div>
                                                        <div className="flex space-x-1">
                                                            <button
                                                                type="submit"
                                                                disabled={isManagingBlacklist}
                                                                className={`flex-1 py-1 px-2 rounded font-medium transition-colors text-xs ${isManagingBlacklist
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-red-600 text-white hover:bg-red-700'
                                                                    }`}
                                                            >
                                                                {isManagingBlacklist ? 'Adding...' : 'Add to Blacklist'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleRemoveBlacklisted}
                                                                disabled={isManagingBlacklist}
                                                                className={`flex-1 py-1 px-2 rounded font-medium transition-colors text-xs ${isManagingBlacklist
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                                    }`}
                                                            >
                                                                {isManagingBlacklist ? 'Removing...' : 'Remove from Blacklist'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>

                                                {/* Token Approval */}
                                                <div className="bg-gray-800 rounded-lg p-3">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Token Approval</h4>
                                                    <form onSubmit={handleApproveToken} className="space-y-2">
                                                        <div>
                                                            <label className="block text-gray-300 text-xs mb-1">Token Address</label>
                                                            <input
                                                                type="text"
                                                                value={tokenAddress}
                                                                onChange={(e) => setTokenAddress(e.target.value)}
                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                                                placeholder="0x..."
                                                                required
                                                            />
                                                        </div>

                                                        {/* Quick Token Selection */}
                                                        <div className="space-y-1">
                                                            <label className="block text-gray-300 text-xs mb-1">Quick Select Test Tokens:</label>
                                                            <div className="flex flex-wrap gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setTokenAddress('0x036CbD53842c5426634e7929541eC2318f3dCF7c')}
                                                                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                                                >
                                                                    USDC (Sepolia)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setTokenAddress('0x4200000000000000000000000000000000000006')}
                                                                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                                                >
                                                                    WETH (Sepolia)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setTokenAddress(process.env.NEXT_PUBLIC_MOCK_TOKEN_ADDRESS || '')}
                                                                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                                                >
                                                                    MATCH
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Token Information Display */}
                                                        {tokenAddress && (
                                                            <div className="mt-2 p-2 bg-gray-700 rounded border border-gray-600">
                                                                {isLoadingTokenInfo ? (
                                                                    <div className="text-gray-400 text-xs">Loading token info...</div>
                                                                ) : tokenInfo ? (
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-gray-300 text-xs">Name:</span>
                                                                            <span className="text-white text-xs font-medium">{tokenInfo.name}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-gray-300 text-xs">Symbol:</span>
                                                                            <span className="text-white text-xs font-medium">{tokenInfo.symbol}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-gray-300 text-xs">Decimals:</span>
                                                                            <span className="text-white text-xs font-medium">{tokenInfo.decimals}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-gray-300 text-xs">Total Supply:</span>
                                                                            <span className="text-white text-xs font-medium">{tokenInfo.totalSupply}</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-red-400 text-xs">Invalid token address or token not found</div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center space-x-2">
                                                            <label className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={tokenApproved}
                                                                    onChange={(e) => setTokenApproved(e.target.checked)}
                                                                    className="mr-1 h-3 w-3 text-blue-600 rounded"
                                                                />
                                                                <span className="text-gray-300 text-xs">Approve Token</span>
                                                            </label>
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={isManagingTokens}
                                                            className={`w-full py-1 px-2 rounded font-medium transition-colors text-xs ${isManagingTokens
                                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                                                }`}
                                                        >
                                                            {isManagingTokens ? 'Updating...' : `${tokenApproved ? 'Approve' : 'Disapprove'} Token`}
                                                        </button>
                                                    </form>
                                                </div>

                                                {/* Approved Tokens Management (Supabase) */}
                                                <div className="bg-gray-800 rounded-lg p-3 md:col-span-2">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Approved Tokens Management</h4>

                                                    {/* Add New Token Form */}
                                                    <form onSubmit={handleAddToken} className="space-y-2 mb-3 p-2 bg-gray-700 rounded">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-gray-300 text-xs mb-1">Token Address</label>
                                                                <input
                                                                    type="text"
                                                                    value={newTokenAddress}
                                                                    onChange={(e) => setNewTokenAddress(e.target.value)}
                                                                    className="w-full p-1 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                                    placeholder="0x..."
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-gray-300 text-xs mb-1">Symbol</label>
                                                                <input
                                                                    type="text"
                                                                    value={newTokenSymbol}
                                                                    onChange={(e) => setNewTokenSymbol(e.target.value)}
                                                                    className="w-full p-1 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                                    placeholder="USDC"
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-gray-300 text-xs mb-1">Name</label>
                                                                <input
                                                                    type="text"
                                                                    value={newTokenName}
                                                                    onChange={(e) => setNewTokenName(e.target.value)}
                                                                    className="w-full p-1 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                                    placeholder="USD Coin"
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-gray-300 text-xs mb-1">Decimals</label>
                                                                <input
                                                                    type="number"
                                                                    value={newTokenDecimals}
                                                                    onChange={(e) => setNewTokenDecimals(e.target.value)}
                                                                    className="w-full p-1 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                                    placeholder="18"
                                                                    min="0"
                                                                    max="18"
                                                                    required
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={isAddingToken}
                                                            className={`w-full py-1 px-2 rounded font-medium transition-colors text-xs ${isAddingToken
                                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                : 'bg-green-600 text-white hover:bg-green-700'
                                                                }`}
                                                        >
                                                            {isAddingToken ? 'Adding...' : 'Add Token'}
                                                        </button>
                                                    </form>

                                                    {/* Tokens List */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-300 text-xs font-medium">Current Tokens:</span>
                                                            <button
                                                                onClick={fetchApprovedTokens}
                                                                disabled={isLoadingApprovedTokens}
                                                                className="text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
                                                            >
                                                                {isLoadingApprovedTokens ? 'Loading...' : 'Refresh'}
                                                            </button>
                                                        </div>

                                                        {isLoadingApprovedTokens ? (
                                                            <div className="text-center py-2">
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mx-auto"></div>
                                                            </div>
                                                        ) : approvedTokens.length === 0 ? (
                                                            <div className="text-gray-400 text-xs text-center py-2">No tokens found</div>
                                                        ) : (
                                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                {approvedTokens.map((token) => (
                                                                    <div key={token.id} className="flex items-center justify-between p-2 bg-gray-700 rounded text-xs">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center space-x-2">
                                                                                <span className="text-white font-medium">{token.symbol}</span>
                                                                                {token.is_native && (
                                                                                    <span className="px-1 py-0.5 bg-blue-600 text-white rounded text-xs">Native</span>
                                                                                )}
                                                                                <span className={`px-1 py-0.5 rounded text-xs ${token.is_approved
                                                                                    ? 'bg-green-600 text-white'
                                                                                    : 'bg-red-600 text-white'
                                                                                    }`}>
                                                                                    {token.is_approved ? 'Approved' : 'Not Approved'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-gray-400 truncate">{token.name}</div>
                                                                            <div className="text-gray-500 font-mono text-xs truncate">{token.address}</div>
                                                                        </div>
                                                                        <div className="flex space-x-1 ml-2">
                                                                            {!token.is_native && (
                                                                                <button
                                                                                    onClick={() => handleUpdateTokenApproval(token.address, !token.is_approved)}
                                                                                    disabled={isUpdatingToken}
                                                                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isUpdatingToken
                                                                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                                        : token.is_approved
                                                                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                                                                            : 'bg-green-600 text-white hover:bg-green-700'
                                                                                        }`}
                                                                                >
                                                                                    {isUpdatingToken ? '...' : token.is_approved ? 'Disapprove' : 'Approve'}
                                                                                </button>
                                                                            )}
                                                                            {!token.is_native && (
                                                                                <button
                                                                                    onClick={() => handleDeleteToken(token.address)}
                                                                                    disabled={isUpdatingToken}
                                                                                    className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                                                                                >
                                                                                    Del
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Multisig Address */}
                                                <div className="bg-gray-800 rounded-lg p-3 md:col-span-2 xl:col-span-1">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Multisig Address</h4>
                                                    <form onSubmit={handleSetMultisigAddress} className="space-y-2">
                                                        <div>
                                                            <label className="block text-gray-300 text-xs mb-1">New Multisig Address</label>
                                                            <input
                                                                type="text"
                                                                value={newMultisigAddress}
                                                                onChange={(e) => setNewMultisigAddress(e.target.value)}
                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                                                placeholder="0x..."
                                                                required
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={isManagingMultisig}
                                                            className={`w-full py-1 px-2 rounded font-medium transition-colors text-xs ${isManagingMultisig
                                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                                                }`}
                                                        >
                                                            {isManagingMultisig ? 'Updating...' : 'Update Multisig Address'}
                                                        </button>
                                                    </form>
                                                </div>

                                                {/* Fund Withdrawal */}
                                                <div className="bg-gray-800 rounded-lg p-3 md:col-span-2 xl:col-span-1">
                                                    <h4 className="text-white font-medium mb-2 text-sm">Fund Withdrawal</h4>
                                                    <form onSubmit={handleWithdrawFunds} className="space-y-2">
                                                        <div>
                                                            <label className="block text-gray-300 text-xs mb-1">Withdrawal Amount (ETH)</label>
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                min="0.001"
                                                                value={withdrawAmount}
                                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                                                placeholder="0.01"
                                                                required
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={isWithdrawing}
                                                            className={`w-full py-1 px-2 rounded font-medium transition-colors text-xs ${isWithdrawing
                                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                : 'bg-orange-600 text-white hover:bg-orange-700'
                                                                }`}
                                                        >
                                                            {isWithdrawing ? 'Withdrawing...' : 'Withdraw Funds'}
                                                        </button>
                                                    </form>
                                                </div>

                                                {/* Manual Tournament Status Update */}
                                                <div className="bg-gray-900 rounded-lg p-4 mt-4">
                                                    <h3 className="text-white text-lg font-semibold mb-3">Manual Tournament Status Update</h3>
                                                    <form onSubmit={handleUpdateTournamentStatus} className="space-y-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-gray-300 text-sm font-medium mb-1">
                                                                    Tournament ID
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={manualTournamentId}
                                                                    onChange={(e) => setManualTournamentId(e.target.value)}
                                                                    placeholder="e.g., 98"
                                                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-gray-300 text-sm font-medium mb-1">
                                                                    Status
                                                                </label>
                                                                <select
                                                                    value={manualStatus}
                                                                    onChange={(e) => setManualStatus(e.target.value)}
                                                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                >
                                                                    <option value="FILLING">FILLING</option>
                                                                    <option value="ACTIVE">ACTIVE</option>
                                                                    <option value="COMPLETED">COMPLETED</option>
                                                                    <option value="CANCELLED">CANCELLED</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <button
                                                                type="submit"
                                                                disabled={isUpdatingStatus}
                                                                className={`w-full py-2 px-4 rounded font-medium transition-colors ${isUpdatingStatus
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                                                    }`}
                                                            >
                                                                {isUpdatingStatus ? 'Updating...' : 'Update Tournament Status'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleProcessTournamentEvents}
                                                                disabled={isProcessingEvents || !manualTournamentId}
                                                                className={`w-full py-2 px-4 rounded font-medium transition-colors ${isProcessingEvents || !manualTournamentId
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                                    }`}
                                                            >
                                                                {isProcessingEvents ? 'Processing...' : 'Process Blockchain Events'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                    <p className="text-gray-400 text-xs mt-2">
                                                        Use this to manually update tournament statuses. For example, set tournament 98 to COMPLETED if it's finished but showing incorrect status.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="lg:col-span-2">
                                        {/* Active Tournaments Section */}
                                        <div className="bg-gray-900 rounded-lg p-4 mt-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="text-white text-lg font-semibold">Active Tournaments</h3>
                                                <button
                                                    onClick={handleManualRefresh}
                                                    disabled={isRefreshing || (isRateLimited && retryAfter !== null && retryAfter > 0)}
                                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${isRefreshing || (isRateLimited && retryAfter !== null && retryAfter > 0)
                                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                        }`}
                                                >
                                                    {isRefreshing ? (
                                                        <span className="flex items-center">
                                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                                            Refreshing...
                                                        </span>
                                                    ) : (
                                                        '🔄 Refresh Data'
                                                    )}
                                                </button>
                                            </div>
                                            {isRateLimited && retryAfter !== null && retryAfter > 0 && (
                                                <p className="text-red-400 text-xs mb-3">
                                                    Rate limited. Please wait {retryCountdown || retryAfter} seconds before refreshing.
                                                </p>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3">
                                                {activeTournaments.length > 0 ? (
                                                    activeTournaments.slice(0, 4).map((tournament) => (
                                                        <div key={tournament.id} className="bg-gray-800 rounded-lg shadow-lg p-3 flex flex-col justify-between transition-transform transform hover:scale-105">
                                                            {/* Tournament Header */}
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <h4 className="text-white font-semibold text-sm">
                                                                        Tournament #{tournament.tournamentId}
                                                                    </h4>
                                                                    <p className="text-gray-400 text-xs mt-1">
                                                                        Room: {tournament.roomCode}
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setTargetTournamentId(tournament.tournamentId);
                                                                        document.getElementById('tournament-id')?.scrollIntoView({ behavior: 'smooth' });
                                                                    }}
                                                                    className="text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-900 px-2 py-1 rounded transition-colors"
                                                                >
                                                                    Select
                                                                </button>
                                                            </div>

                                                            {/* Status Badge */}
                                                            <div className="mb-2">
                                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${tournament.status === 'ACTIVE'
                                                                    ? 'bg-green-900 text-green-300 border-green-600'
                                                                    : tournament.status === 'FILLING'
                                                                        ? 'bg-yellow-900 text-yellow-300 border-yellow-600'
                                                                        : tournament.status === 'COMPLETED'
                                                                            ? 'bg-blue-900 text-blue-300 border-blue-600'
                                                                            : 'bg-gray-700 text-gray-300 border-gray-600'
                                                                    }`}>
                                                                    {tournament.status}
                                                                </span>
                                                            </div>

                                                            {/* Player Count */}
                                                            <div className="mb-2">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-xs font-medium text-gray-300">Players</span>
                                                                    <span className="text-xs text-gray-400 font-medium">
                                                                        {tournament.currentParticipants || 0}/{tournament.maxParticipants || 0}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                                                    <div
                                                                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                                                                        style={{
                                                                            width: `${Math.min(100, ((tournament.currentParticipants || 0) / (tournament.maxParticipants || 1)) * 100)}%`
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                            </div>

                                                            {/* Pool Amount */}
                                                            <div className="mb-2">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs font-medium text-gray-300">Pool Amount</span>
                                                                    <span className="text-xs font-bold text-green-400">
                                                                        {tournament.totalPrize ? `${tournament.totalPrize.toFixed(4)} ETH` : 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Entry Fee */}
                                                            <div className="pt-2 border-t border-gray-700">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs text-gray-400">Entry Fee</span>
                                                                    <span className="text-xs font-medium text-gray-300">
                                                                        {tournament.entryFeeFormatted ? `${tournament.entryFeeFormatted} ETH` : 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Winners Section - Only for completed tournaments */}
                                                            {tournament.status === 'COMPLETED' && tournament.winners && tournament.winners.length > 0 && (
                                                                <div className="pt-2 border-t border-gray-700">
                                                                    <div className="mb-1">
                                                                        <span className="text-xs text-gray-400 font-medium">🏆 Winners</span>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        {tournament.winners.slice(0, 2).map((winner, index) => {
                                                                            const calculatedPayout = calculateWinnerPayout(
                                                                                winner.rank,
                                                                                tournament.totalPrize || 0,
                                                                                tournament.winners?.length || 0
                                                                            );
                                                                            const actualPayout = winner.payoutFormatted || '0';
                                                                            const hasClaimed = winner.hasClaimed || false;

                                                                            return (
                                                                                <div key={winner.address} className="flex justify-between items-center">
                                                                                    <div className="flex items-center space-x-1">
                                                                                        <span className="text-xs text-yellow-400 font-bold">
                                                                                            #{winner.rank}
                                                                                        </span>
                                                                                        <span className="text-xs text-gray-300 truncate max-w-[40px]">
                                                                                            {winner.name}
                                                                                        </span>
                                                                                        {hasClaimed && (
                                                                                            <span className="text-xs text-green-400 bg-green-900 px-1 rounded">
                                                                                                ✓
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex flex-col items-end">
                                                                                        <span className="text-xs text-green-400 font-medium">
                                                                                            {actualPayout} ETH
                                                                                        </span>
                                                                                        {winner.payoutFormatted && (
                                                                                            <span className="text-xs text-gray-500">
                                                                                                Est: {calculatedPayout.toFixed(4)} ETH
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="text-xs text-gray-500 font-mono">
                                                                                            {winner.address.substring(0, 4)}...{winner.address.substring(winner.address.length - 4)}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        {tournament.winners && tournament.winners.length > 2 && (
                                                                            <div className="text-xs text-gray-500 text-center">
                                                                                +{tournament.winners.length - 2} more winners
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-full text-center py-6">
                                                        <p className="text-gray-400">No active tournaments found.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}