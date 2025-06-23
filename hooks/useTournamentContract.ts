// hooks/useTournamentContract.ts - With RPC rate limit handling
import { useState, useCallback, useRef } from 'react';
import { ethers } from "ethers";
import { TournamentABI } from "@/app/lib/contracts/abis/TournamentABI";
import { usePrivy } from '@privy-io/react-auth';

// Global cache object to store important data with TTL
const CACHE = {
    // Admin status cache - lasts 10 minutes
    adminStatus: new Map<string, { value: boolean, timestamp: number }>(),

    // Tournament details cache - lasts 2 minutes
    tournamentDetails: new Map<number, { value: any, timestamp: number }>(),

    // Winner data cache - lasts 2 minutes
    winnerData: new Map<string, { value: any, timestamp: number }>(),

    // Participant status cache - lasts 1 minute
    participantStatus: new Map<string, { value: boolean, timestamp: number }>(),

    // Matching pool balance cache - lasts 1 minute
    matchingPool: new Map<string, { value: string, timestamp: number }>(),

    // Check if cached data is still valid
    isValid: (timestamp: number, ttl: number) => (Date.now() - timestamp) < ttl,

    // Store data in cache
    set: <T>(cache: Map<any, { value: T, timestamp: number }>, key: any, value: T) => {
        cache.set(key, { value, timestamp: Date.now() });
    },

    // Get data from cache if valid
    get: <T>(cache: Map<any, { value: T, timestamp: number }>, key: any, ttl: number): T | null => {
        const entry = cache.get(key);
        if (entry && CACHE.isValid(entry.timestamp, ttl)) {
            console.log(`Using cached data for ${key}, age: ${(Date.now() - entry.timestamp) / 1000}s`);
            return entry.value;
        }
        return null;
    },

    has: (cache: Map<any, { value: any, timestamp: number }>, key: any) => cache.has(key),

    delete: (cache: Map<any, { value: any, timestamp: number }>, key: any) => cache.delete(key),

    clear: (cache: Map<any, { value: any, timestamp: number }>) => cache.clear()
};

// TTL constants
const TTL = {
    TOURNAMENT_DETAILS: 2 * 60 * 1000, // 2 minutes
    ADMIN_STATUS: 10 * 60 * 1000,      // 10 minutes
    MATCHING_POOL: 1 * 60 * 1000,      // 1 minute
};

// Keep track of pending requests to avoid duplicate calls
const pendingRequests = new Map<string, Promise<any>>();

// Create a cache instance for RPC calls with a TTL of 2 minutes
const rpcCache = {
    get: (key: string) => CACHE.get(CACHE.tournamentDetails, key, TTL.TOURNAMENT_DETAILS),
    set: (key: string, value: any) => CACHE.set(CACHE.tournamentDetails, key, value),
    has: (key: string) => CACHE.has(CACHE.tournamentDetails, key),
    delete: (key: string) => CACHE.delete(CACHE.tournamentDetails, key),
    clear: () => CACHE.clear(CACHE.tournamentDetails)
};

// Keep a fallback counter for when tournament IDs can't be retrieved
let fallbackIdCounter = Math.floor(Date.now() / 1000);

/**
 * A generic ERC20 ABI for interacting with tokens.
 * This is used for the approval and allowance checks.
 */
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

export function useTournamentContract() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = usePrivy();
    const address = user?.wallet?.address;

    // Get ethers provider and signer
    let provider: ethers.providers.Web3Provider | undefined;
    let signer: ethers.Signer | undefined;
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        provider = new ethers.providers.Web3Provider((window as any).ethereum);
        signer = provider.getSigner();
    }

    const contractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS || '';

    // Helper to get contract instance with connected signer
    async function getContractAsync() {
        if (!user?.wallet?.address) {
            throw new Error('Wallet not connected. Please connect your wallet first.');
        }

        // Check if ethereum provider is available
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            throw new Error('Ethereum provider not available. Please ensure your wallet is connected.');
        }

        try {
            const provider = new ethers.providers.Web3Provider((window as any).ethereum);
            const signer = provider.getSigner();

            // Verify the signer address matches Privy's wallet address
            const signerAddress = await signer.getAddress();
            if (signerAddress.toLowerCase() !== user.wallet.address.toLowerCase()) {
                throw new Error('Wallet address mismatch. Please reconnect your wallet.');
            }

            return new ethers.Contract(contractAddress, TournamentABI, signer);
        } catch (error) {
            console.error('Error getting contract instance:', error);
            throw new Error('Failed to initialize contract. Please check your wallet connection.');
        }
    }

    // Track and limit RPC requests
    const requestsInLastSecond = useRef<number>(0);
    const lastRequestReset = useRef<number>(Date.now());
    const MAX_REQUESTS_PER_SECOND = 5; // Limit ThirdWeb RPC calls

    // Helper function to handle rate limiting for RPC calls
    const throttledRPCCall = async <T>(
        cacheKey: string,
        ttl: number,
        fetchFn: () => Promise<T>
    ): Promise<T> => {
        // Check if we're already fetching this data
        if (pendingRequests.has(cacheKey)) {
            console.log(`Using pending request for ${cacheKey}`);
            return pendingRequests.get(cacheKey) as Promise<T>;
        }

        // Rate limit reset logic
        const now = Date.now();
        if (now - lastRequestReset.current > 1000) {
            lastRequestReset.current = now;
            requestsInLastSecond.current = 0;
        }

        // Check if we're over the rate limit
        if (requestsInLastSecond.current >= MAX_REQUESTS_PER_SECOND) {
            console.warn(`RPC rate limit reached, delaying request for ${cacheKey}`);
            // Wait for the rate limit to reset
            await new Promise(resolve => setTimeout(resolve, 1000 - (now - lastRequestReset.current)));
            // Recursive call after waiting
            return throttledRPCCall(cacheKey, ttl, fetchFn);
        }

        // Create the promise
        const fetchPromise = (async () => {
            try {
                // Increment request counter
                requestsInLastSecond.current++;
                return await fetchFn();
            } finally {
                // Remove from pending requests when done
                pendingRequests.delete(cacheKey);
            }
        })();

        // Store the promise
        pendingRequests.set(cacheKey, fetchPromise);

        return fetchPromise;
    };

    // Get tournament details with caching and rate limiting
    async function getTournamentDetails(tournamentId: number) {
        const cacheKey = `tournament_${tournamentId}`;
        const cached = rpcCache.get(cacheKey);

        if (cached) {
            console.log(`[Cache HIT] Returning cached details for tournament ${tournamentId}`);
            return cached.value;
        }

        console.log(`[Cache MISS] Fetching details for tournament ${tournamentId}`);

        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!tournamentId) {
                throw new Error("Invalid tournament ID");
            }

            setIsLoading(true);
            setError(null);

            // Function to fetch from blockchain
            const fetchDetails = async () => {
                console.log(`Fetching tournament details from blockchain for ID: ${tournamentId}`);

                // Get the contract instance with ABI
                const contract = await getContractAsync();

                // Call the tournaments mapping
                const tournament = await contract.tournaments(tournamentId);

                if (!tournament) {
                    throw new Error(`Tournament with ID ${tournamentId} not found`);
                }

                // Get current tournament round if available
                let currentRound = 0;
                try {
                    currentRound = await contract.currentTournamentRound(tournamentId);
                } catch (err) {
                    console.log("Could not get current tournament round:", err);
                }

                // Simplify entrants count to reduce RPC calls
                let currentEntrants = 0;
                try {
                    // Check a few key positions instead of all slots
                    const numEntrants = parseInt(tournament.numEntrants?.toString() || '0');

                    if (numEntrants > 0) {
                        // Check first slot
                        const firstEntrant = await contract.tournamentEntrants(tournamentId, 0);
                        if (firstEntrant !== ethers.constants.AddressZero) {
                            // At least one entrant
                            currentEntrants = 1;

                            // If more than 5 entrants possible, check the middle slot
                            if (numEntrants > 5) {
                                const midSlot = Math.floor(numEntrants / 2);
                                const midEntrant = await contract.tournamentEntrants(tournamentId, midSlot);

                                if (midEntrant !== ethers.constants.AddressZero) {
                                    // If middle slot filled, assume at least half full
                                    currentEntrants = midSlot + 1;

                                    // Check last slot to see if full
                                    const lastEntrant = await contract.tournamentEntrants(tournamentId, numEntrants - 1);
                                    if (lastEntrant !== ethers.constants.AddressZero) {
                                        // If last slot filled, tournament is full
                                        currentEntrants = numEntrants;
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn("Could not count entrants:", err);
                }

                // Format the tournament data
                const tournamentDetails = {
                    tournamentId,
                    winnersPercentage: tournament.winnersPercentage,
                    multisigPercentage: tournament.multisigPercentage,
                    isActive: tournament.isActive,
                    hasStarted: tournament.hasStarted,
                    isERC20: tournament.isERC20,
                    hasEntryFee: tournament.hasEntryFee,
                    numEntrants: parseInt(tournament.numEntrants?.toString() || '0'),
                    currentEntrants: currentEntrants,
                    totalDonations: tournament.totalDonations?.toString() || '0',
                    totalTokenDonations: tournament.totalTokenDonations?.toString() || '0',
                    remainingBalance: tournament.remainingBalance?.toString() || '0',
                    entryFee: ethers.utils.formatEther(tournament.entryFee?.toString() || '0'),
                    token: tournament.token,
                    currentRound: currentRound?.toString() || '0'
                };

                // Cache the result
                rpcCache.set(cacheKey, tournamentDetails);

                return tournamentDetails;
            };

            // Use throttled call
            return await throttledRPCCall(
                cacheKey,
                TTL.TOURNAMENT_DETAILS,
                fetchDetails
            );
        } catch (err: any) {
            console.error("Error getting tournament details:", err);
            setError(err.message || "Failed to get tournament details");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Check if an address is an admin with caching
    async function isAdmin(checkAddress: string) {
        // Use cache for admin status
        const cachedStatus = CACHE.get(CACHE.adminStatus, checkAddress, TTL.ADMIN_STATUS);
        if (cachedStatus !== null) {
            return cachedStatus;
        }

        const fetchAdminStatus = async () => {
            try {
                const contract = await getContractAsync();
                const status = await contract.isAdmin(checkAddress);
                // Cache the result
                CACHE.set(CACHE.adminStatus, checkAddress, status);
                return status;
            } catch (error: any) {
                console.error(`Error checking admin status for ${checkAddress}:`, error);
                return false;
            }
        };

        return await throttledRPCCall(`admin-${checkAddress}`, TTL.ADMIN_STATUS, fetchAdminStatus);
    }

    // Check if a user is a participant in a tournament
    async function isEntrantInTournament(tournamentId: number, playerAddress: string) {
        try {
            if (!signer) throw new Error('Wallet not connected or provider not available');
            const contract = await getContractAsync();
            return await contract.isEntrantInTournament(tournamentId, playerAddress);
        } catch (err) {
            console.error("Error checking participant status:", err);
            return false;
        }
    }

    // Get matching pool balance with caching
    async function getMatchingPoolBalance() {
        const cacheKey = 'matching-pool-balance';
        const cached = CACHE.get(CACHE.matchingPool, cacheKey, TTL.MATCHING_POOL);

        if (cached !== null) return cached;

        const fetchBalance = async () => {
            try {
                const contract = await getContractAsync();
                const balance = await contract.matchingPool();
                const formattedBalance = ethers.utils.formatUnits(balance, 18); // Assuming 18 decimals
                CACHE.set(CACHE.matchingPool, cacheKey, formattedBalance);
                return formattedBalance;
            } catch (error: any) {
                console.error('Error fetching matching pool balance:', error);
                return '0';
            }
        };

        return await throttledRPCCall('matching-pool-balance', TTL.MATCHING_POOL, fetchBalance);
    }

    // Create a new tournament
    async function createTournament(params: {
        numEntrants: number;
        winnersPercentage: number;
        multisigPercentage: number;
        tokenAddress: string;
        entryFee: string;
    }) {
        if (!address) {
            throw new Error("Wallet not connected or provider not initialized");
        }
        setIsLoading(true);
        setError(null);
        try {
            const contract = await getContractAsync();
            let entryFeeWei;
            if (params.entryFee && params.entryFee.toString().length > 10) {
                entryFeeWei = ethers.BigNumber.from(params.entryFee);
            } else {
                entryFeeWei = ethers.utils.parseEther(params.entryFee);
            }

            // Try to get current next tournament ID before transaction
            let nextIdBefore;
            try {
                nextIdBefore = await contract.nextTournamentId();
                console.log(`Current nextTournamentId before transaction: ${nextIdBefore.toString()}`);
            } catch (e) {
                console.warn(`Could not get nextTournamentId before transaction:`, e);
            }

            // Call the contract function
            const tx = await contract.createTournament(
                params.numEntrants,
                params.winnersPercentage,
                params.multisigPercentage,
                params.tokenAddress,
                entryFeeWei
            );

            console.log("Transaction submitted:", tx.hash || "No hash available");

            // Handle different transaction response formats
            let receipt;
            if (typeof tx.wait === 'function') {
                try {
                    receipt = await tx.wait();
                    console.log("Transaction confirmed:", receipt);
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                    receipt = tx;
                }
            } else {
                receipt = tx;
            }

            // Try multiple ways to extract the tournament ID
            let tournamentId = "";

            // Check 1: Look for TournamentCreated event
            if (receipt.events) {
                const tournamentCreatedEvent = receipt.events.find(
                    (event: any) => event.event === "TournamentCreated"
                );

                if (tournamentCreatedEvent && tournamentCreatedEvent.args) {
                    tournamentId = tournamentCreatedEvent.args.tournamentId.toString();
                    console.log("Tournament ID from event:", tournamentId);
                }
            }

            // Check 2: Look for the ID in the tx object if Check 1 failed
            if (!tournamentId && typeof tx === 'object' && tx !== null) {
                if ('tournamentId' in tx) {
                    tournamentId = tx.tournamentId?.toString() || "";
                    console.log("Tournament ID from tx object:", tournamentId);
                }
            }

            // Check 3: Compare nextTournamentId before and after
            if (!tournamentId && nextIdBefore) {
                try {
                    const nextIdAfter = await contract.nextTournamentId();
                    console.log(`nextTournamentId after transaction: ${nextIdAfter.toString()}`);

                    if (nextIdAfter > nextIdBefore) {
                        tournamentId = nextIdBefore.toString();
                        console.log("Tournament ID from nextTournamentId comparison:", tournamentId);
                    }
                } catch (e) {
                    console.warn(`Could not get nextTournamentId after transaction:`, e);
                }
            }

            // Check 4: Last resort - use a timestamp-based ID as fallback
            if (!tournamentId) {
                tournamentId = (++fallbackIdCounter).toString();
                console.log("Using fallback timestamp-based tournament ID:", tournamentId);
            }

            // Clear any cached data for this tournament
            if (tournamentId) {
                const tournamentIdNum = parseInt(tournamentId);
                CACHE.tournamentDetails.delete(tournamentIdNum);
            }

            return {
                hash: tx.hash || "unknown",
                receipt: receipt,
                tournamentId: tournamentId
            };
        } catch (err: any) {
            console.error("Error creating tournament:", err);
            setError(err.message || "Failed to create tournament");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Join an existing tournament
    async function joinTournament(tournamentId: number, entryFee: string, isErc20: boolean) {
        if (!address) {
            throw new Error("Wallet not connected or provider not initialized");
        }
        setIsLoading(true);
        setError(null);
        try {
            console.log('[DEBUG] joinTournament called with:', { tournamentId, entryFee, address });

            const contract = await getContractAsync();
            console.log('[DEBUG] Contract instance created successfully');

            let entryFeeWei;
            if (entryFee && entryFee.toString().length > 10) {
                entryFeeWei = ethers.BigNumber.from(entryFee);
            } else {
                entryFeeWei = ethers.utils.parseEther(entryFee);
            }
            console.log('[DEBUG] Entry fee converted to Wei:', entryFeeWei.toString());

            const txOptions: { value?: ethers.BigNumber } = {};
            if (!isErc20) {
                txOptions.value = entryFeeWei;
            }

            console.log('[DEBUG] About to call contract.joinTournament with options:', txOptions);
            const tx = await contract.joinTournament(tournamentId, txOptions);
            console.log('[DEBUG] Transaction submitted:', tx.hash);

            console.log('[DEBUG] Waiting for transaction confirmation...');
            await tx.wait();
            console.log('[DEBUG] Transaction confirmed!');

            return { hash: tx.hash, receipt: tx };
        } catch (err: any) {
            console.error('[DEBUG] Error in joinTournament:', {
                message: err.message,
                code: err.code,
                reason: err.reason,
                error: err.error,
                data: err.data,
                transaction: err.transaction,
                receipt: err.receipt,
                stack: err.stack,
                fullError: err
            });

            // Set a more descriptive error message
            let errorMessage = "Failed to join tournament";
            if (err.message) {
                errorMessage = err.message;
            } else if (err.reason) {
                errorMessage = err.reason;
            } else if (err.error?.message) {
                errorMessage = err.error.message;
            }

            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Fill up matching pool
    async function fillUpMatchingPool(amount: ethers.BigNumber) {
        if (!signer) {
            throw new Error("Wallet not connected or provider not available");
        }
        setIsLoading(true);
        setError(null);
        try {
            console.log("Adding funds to matching pool:", amount.toString());

            const contract = await getContractAsync();

            // Call the fillUpMatchingPool function (which is payable)
            const tx = await contract.fillUpMatchingPool({ value: amount });

            console.log("Add funds transaction submitted:", tx);

            // Clear any cached balance
            CACHE.matchingPool.delete('balance');

            // Handle different transaction response formats
            let receipt;
            if (typeof tx.wait === 'function') {
                try {
                    receipt = await tx.wait();
                    console.log("Transaction confirmed:", receipt);
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                    receipt = { hash: tx.hash || "unknown" };
                }
            } else {
                receipt = { hash: tx.hash || tx.transactionHash || "unknown" };
            }

            return {
                hash: receipt.hash,
                receipt: receipt
            };
        } catch (err: any) {
            console.error("Error adding funds to matching pool:", err);
            setError(err.message || "Failed to add funds to matching pool");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Allocate funds from matching pool to tournament
    async function allocateMatchingPoolToTournament(tournamentId: number) {
        if (!signer) {
            throw new Error("Wallet not connected or provider not available");
        }
        setIsLoading(true);
        setError(null);
        try {
            console.log("Allocating funds to tournament:", tournamentId);

            const contract = await getContractAsync();

            // Call the allocateMatchingPoolToTournament function
            const tx = await contract.allocateMatchingPoolToTournament(tournamentId);

            console.log("Allocation transaction submitted:", tx);

            // Clear caches
            CACHE.matchingPool.delete('balance');
            CACHE.tournamentDetails.delete(tournamentId);

            // Handle different transaction response formats
            let receipt;
            if (typeof tx.wait === 'function') {
                try {
                    receipt = await tx.wait();
                    console.log("Transaction confirmed:", receipt);
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                    receipt = { hash: tx.hash || "unknown" };
                }
            } else {
                receipt = { hash: tx.hash || tx.transactionHash || "unknown" };
            }

            return {
                hash: receipt.hash,
                receipt: receipt
            };
        } catch (err: any) {
            console.error("Error allocating funds to tournament:", err);
            setError(err.message || "Failed to allocate funds to tournament");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // End a tournament and distribute prizes
    async function endTournament(
        tournamentId: number,
        winners: string[],  // Array of winner addresses
        percentages: number[]  // Array of percentages for each winner (must sum to 100)
    ) {
        if (!signer) {
            throw new Error("Wallet not connected or provider not available");
        }
        setIsLoading(true);
        setError(null);
        try {
            // Validate percentages
            const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
            if (totalPercentage !== 100) {
                throw new Error(`Winner percentages must sum to 100, got ${totalPercentage}`);
            }

            if (winners.length !== percentages.length) {
                throw new Error("Winners and percentages arrays must have the same length");
            }

            if (winners.length === 0) {
                throw new Error("No winners provided");
            }

            // Check for invalid addresses
            for (const winner of winners) {
                if (!winner || winner === '0x0000000000000000000000000000000000000000') {
                    throw new Error("Invalid winner address detected");
                }
            }

            const contract = await getContractAsync();

            console.log("Ending tournament:", {
                tournamentId,
                winners,
                percentages
            });

            // Call the endTournament function
            const tx = await contract.endTournament(
                tournamentId,
                winners,
                percentages
            );

            console.log("End tournament transaction submitted:", tx);

            // Clear any cached data for this tournament
            CACHE.tournamentDetails.delete(tournamentId);

            // Handle different transaction response formats
            let receipt;
            if (typeof tx.wait === 'function') {
                try {
                    receipt = await tx.wait();
                    console.log("Transaction confirmed:", receipt);
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                    receipt = { hash: tx.hash || "unknown", status: 1 };
                }
            } else if (tx.receipt) {
                receipt = tx.receipt;
            } else {
                receipt = { hash: tx.hash || tx.transactionHash || "unknown", status: 1 };
            }

            return {
                hash: tx.hash || tx.transactionHash || "unknown",
                receipt: receipt
            };
        } catch (err: any) {
            console.error("Error ending tournament:", err);
            setError(err.message || "Failed to end tournament");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Start a tournament
    async function startTournament(tournamentId: number) {
        if (!signer) {
            throw new Error("Wallet not connected or provider not available");
        }
        setIsLoading(true);
        setError(null);
        try {
            console.log("Starting tournament with ID:", tournamentId);

            // Clear cache BEFORE the transaction to ensure we fetch fresh data
            CACHE.tournamentDetails.delete(tournamentId);

            const contract = await getContractAsync();

            // Call the startTournament function
            const tx = await contract.startTournament(tournamentId);

            console.log("Start tournament transaction submitted:", tx);

            // Handle different transaction response formats
            let receipt;
            if (typeof tx.wait === 'function') {
                try {
                    receipt = await tx.wait();
                    console.log("Start tournament transaction confirmed:", receipt);
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                    receipt = { hash: tx.hash || "unknown" };
                }
            } else {
                receipt = { hash: tx.hash || tx.transactionHash || "unknown" };
            }

            return {
                hash: receipt.hash || "unknown",
                tournamentId: tournamentId
            };
        } catch (err: any) {
            console.error("Error starting tournament:", err);
            setError(err.message || "Failed to start tournament");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Save game result (mock function)
    async function saveGameResult(gameId: string, playerAddress: string, score: number) {
        if (!signer || !playerAddress) {
            console.error("Cannot save game result: Wallet not connected or no player address");
            return null;
        }

        try {
            console.log(`Saving game result: Game ID ${gameId}, Player ${playerAddress}, Score ${score}`);

            // This is a mock function since saveGameResult isn't part of the contract
            return {
                hash: `simulated-tx-${Date.now()}`,
                success: true
            };
        } catch (err: any) {
            console.error("Error saving game result:", err);
            setError(err.message || "Failed to save game result");
            return null;
        }
    }

    // Get tournament winner data (payout amount and claim status)
    async function getTournamentWinnerData(tournamentId: number, winnerAddress: string): Promise<{ amount: string; hasClaimed: boolean }> {
        const cacheKey = `winner-${tournamentId}-${winnerAddress}`;
        const cachedData = CACHE.get(CACHE.winnerData, cacheKey, TTL.TOURNAMENT_DETAILS);
        if (cachedData) {
            return cachedData;
        }

        const fetchWinnerData = async (): Promise<{ amount: string; hasClaimed: boolean }> => {
            try {
                const contract = await getContractAsync();
                const data = await contract.getTournamentWinner(tournamentId, winnerAddress);
                const winnerData = { amount: data.amount.toString(), hasClaimed: data.hasClaimed };
                // Cache the result
                CACHE.set(CACHE.winnerData, cacheKey, winnerData);
                return winnerData;
            } catch (err) {
                console.error(`Error fetching winner data for ${winnerAddress} in tournament ${tournamentId}:`, err);
                return { amount: '0', hasClaimed: false };
            }
        };

        return await throttledRPCCall(cacheKey, TTL.TOURNAMENT_DETAILS, fetchWinnerData);
    }

    // Smart Contract Management Functions
    async function addAdmin(adminAddress: string) {
        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!adminAddress || !ethers.utils.isAddress(adminAddress)) {
                throw new Error("Invalid admin address");
            }

            setIsLoading(true);
            setError(null);

            const contract = await getContractAsync();
            const tx = await contract.addAdmin(adminAddress);
            const receipt = await tx.wait();

            console.log("Admin added successfully:", receipt);
            return { hash: tx.hash, receipt };
        } catch (error: any) {
            console.error('Error adding admin:', error);
            setError(error.message || 'Failed to add admin');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function removeAdmin(adminAddress: string) {
        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!adminAddress || !ethers.utils.isAddress(adminAddress)) {
                throw new Error("Invalid admin address");
            }

            setIsLoading(true);
            setError(null);

            const contract = await getContractAsync();
            const tx = await contract.removeAdmin(adminAddress);
            const receipt = await tx.wait();

            console.log("Admin removed successfully:", receipt);
            return { hash: tx.hash, receipt };
        } catch (error: any) {
            console.error('Error removing admin:', error);
            setError(error.message || 'Failed to remove admin');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function addBlacklisted(address: string) {
        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!address || !ethers.utils.isAddress(address)) {
                throw new Error("Invalid address");
            }

            setIsLoading(true);
            setError(null);

            const contract = await getContractAsync();
            const tx = await contract.addBlacklisted(address);
            const receipt = await tx.wait();

            console.log("Address blacklisted successfully:", receipt);
            return { hash: tx.hash, receipt };
        } catch (error: any) {
            console.error('Error blacklisting address:', error);
            setError(error.message || 'Failed to blacklist address');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function removeBlacklisted(address: string) {
        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!address || !ethers.utils.isAddress(address)) {
                throw new Error("Invalid address");
            }

            setIsLoading(true);
            setError(null);

            const contract = await getContractAsync();
            const tx = await contract.removeBlacklisted(address);
            const receipt = await tx.wait();

            console.log("Address removed from blacklist successfully:", receipt);
            return { hash: tx.hash, receipt };
        } catch (error: any) {
            console.error('Error removing from blacklist:', error);
            setError(error.message || 'Failed to remove from blacklist');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function approveToken(tokenAddress: string, approved: boolean) {
        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
                throw new Error("Invalid token address");
            }

            setIsLoading(true);
            setError(null);

            const contract = await getContractAsync();
            const tx = await contract.approveToken(tokenAddress, approved);
            const receipt = await tx.wait();

            console.log("Token approval updated successfully:", receipt);
            return { hash: tx.hash, receipt };
        } catch (error: any) {
            console.error('Error updating token approval:', error);
            setError(error.message || 'Failed to update token approval');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function setMultisigAddress(multisigAddress: string) {
        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!multisigAddress || !ethers.utils.isAddress(multisigAddress)) {
                throw new Error("Invalid multisig address");
            }

            setIsLoading(true);
            setError(null);

            const contract = await getContractAsync();
            const tx = await contract.setMultisigAddress(multisigAddress);
            const receipt = await tx.wait();

            console.log("Multisig address updated successfully:", receipt);
            return { hash: tx.hash, receipt };
        } catch (error: any) {
            console.error('Error updating multisig address:', error);
            setError(error.message || 'Failed to update multisig address');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function checkAllowance(tokenAddress: string, owner: string, spender: string): Promise<ethers.BigNumber> {
        if (!provider) {
            throw new Error("Provider not available");
        }
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        return await tokenContract.allowance(owner, spender);
    }

    async function approveTokenSpend(tokenAddress: string, amount: ethers.BigNumber): Promise<ethers.providers.TransactionResponse> {
        if (!signer) {
            throw new Error("Wallet not connected or provider not available");
        }
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const tx = await tokenContract.approve(process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS, amount);
        return tx;
    }

    async function withdrawFunds(amount: ethers.BigNumber) {
        try {
            if (!signer) {
                throw new Error("Wallet not connected or provider not available");
            }

            if (!amount || amount.lte(0)) {
                throw new Error("Invalid withdrawal amount");
            }

            setIsLoading(true);
            setError(null);

            const contract = await getContractAsync();
            const tx = await contract.withdrawFunds(amount);
            const receipt = await tx.wait();

            console.log("Funds withdrawn successfully:", receipt);
            return { hash: tx.hash, receipt };
        } catch (error: any) {
            console.error('Error withdrawing funds:', error);
            setError(error.message || 'Failed to withdraw funds');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    return {
        createTournament,
        joinTournament,
        isEntrantInTournament,
        endTournament,
        getTournamentDetails,
        isAdmin,
        saveGameResult,
        startTournament,
        fillUpMatchingPool,
        allocateMatchingPoolToTournament,
        getMatchingPoolBalance,
        getTournamentWinnerData,
        isLoading,
        error,
        addAdmin,
        removeAdmin,
        addBlacklisted,
        removeBlacklisted,
        approveToken,
        setMultisigAddress,
        withdrawFunds,
        checkAllowance,
        approveTokenSpend
    };
}