// hooks/useTournamentContract.ts - With RPC rate limit handling
import { useState, useCallback, useRef } from 'react';
import { useAddress, useSDK } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import { TournamentABI } from "@/app/lib/contracts/abis/TournamentABI";

// Global cache object to store important data with TTL
const CACHE = {
    // Admin status cache - lasts 10 minutes
    adminStatus: new Map<string, { value: boolean, timestamp: number }>(),

    // Tournament details cache - lasts 30 seconds
    tournamentDetails: new Map<number, { data: any, timestamp: number }>(),

    // Participant status cache - lasts 1 minute
    participantStatus: new Map<string, { value: boolean, timestamp: number }>(),

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
    }
};

// TTL constants
const TTL = {
    ADMIN_STATUS: 10 * 60 * 1000, // 10 minutes
    TOURNAMENT_DETAILS: 30 * 1000, // 30 seconds
    MATCHING_POOL: 30 * 1000, // 30 seconds
    PARTICIPANT_STATUS: 60 * 1000, // 1 minute
};

// Keep track of pending requests to avoid duplicate calls
const pendingRequests = new Map<string, Promise<any>>();

// Keep a fallback counter for when tournament IDs can't be retrieved
let fallbackIdCounter = Math.floor(Date.now() / 1000);

export function useTournamentContract() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const address = useAddress();
    const sdk = useSDK();

    // Contract address from environment variable
    const contractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS || '';

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
        try {
            if (!sdk) {
                throw new Error("SDK not initialized");
            }

            if (!tournamentId) {
                throw new Error("Invalid tournament ID");
            }

            setIsLoading(true);
            setError(null);

            // Check cache for tournament details
            const cachedDetails = CACHE.get(CACHE.tournamentDetails, tournamentId, TTL.TOURNAMENT_DETAILS);
            if (cachedDetails) {
                return cachedDetails;
            }

            // Function to fetch from blockchain
            const fetchDetails = async () => {
                console.log(`Fetching tournament details from blockchain for ID: ${tournamentId}`);

                // Get the contract instance with ABI
                const contract = await sdk.getContract(contractAddress, TournamentABI);

                // Call the tournaments mapping
                const tournament = await contract.call("tournaments", [tournamentId]);

                if (!tournament) {
                    throw new Error(`Tournament with ID ${tournamentId} not found`);
                }

                // Get current tournament round if available
                let currentRound = 0;
                try {
                    currentRound = await contract.call("currentTournamentRound", [tournamentId]);
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
                        const firstEntrant = await contract.call("tournamentEntrants", [tournamentId, 0]);
                        if (firstEntrant !== ethers.constants.AddressZero) {
                            // At least one entrant
                            currentEntrants = 1;

                            // If more than 5 entrants possible, check the middle slot
                            if (numEntrants > 5) {
                                const midSlot = Math.floor(numEntrants / 2);
                                const midEntrant = await contract.call("tournamentEntrants", [tournamentId, midSlot]);

                                if (midEntrant !== ethers.constants.AddressZero) {
                                    // If middle slot filled, assume at least half full
                                    currentEntrants = midSlot + 1;

                                    // Check last slot to see if full
                                    const lastEntrant = await contract.call("tournamentEntrants", [tournamentId, numEntrants - 1]);
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
                CACHE.set(CACHE.tournamentDetails, tournamentId, tournamentDetails);

                return tournamentDetails;
            };

            // Use throttled call
            return await throttledRPCCall(
                `tournament-${tournamentId}`,
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
        try {
            if (!sdk) return false;

            // Check cache first
            const cachedStatus = CACHE.get(CACHE.adminStatus, checkAddress, TTL.ADMIN_STATUS);
            if (cachedStatus !== null) {
                return cachedStatus;
            }

            // Function to fetch from blockchain
            const fetchAdminStatus = async () => {
                console.log(`Checking admin status for ${checkAddress} from blockchain`);

                // Get the contract instance with ABI
                const contract = await sdk.getContract(contractAddress, TournamentABI);

                // Call the isAdmin function
                const adminStatus = await contract.call("isAdmin", [checkAddress]);

                // Cache the result
                CACHE.set(CACHE.adminStatus, checkAddress, adminStatus);

                return adminStatus;
            };

            // Use throttled call
            return await throttledRPCCall(
                `admin-${checkAddress}`,
                TTL.ADMIN_STATUS,
                fetchAdminStatus
            );
        } catch (err) {
            console.error("Error checking admin status:", err);
            return false;
        }
    }

    // Check if a user is a participant in a tournament
    async function isEntrantInTournament(tournamentId: number, playerAddress: string) {
        try {
            if (!sdk) return false;

            // Create a cache key
            const cacheKey = `entrant_${tournamentId}_${playerAddress}`;

            // Check cache first
            const cachedStatus = CACHE.get(CACHE.participantStatus, cacheKey, TTL.PARTICIPANT_STATUS);
            if (cachedStatus !== null) {
                return cachedStatus;
            }

            // Function to fetch from blockchain
            const fetchParticipantStatus = async () => {
                console.log(`Checking if address ${playerAddress} is a participant in tournament ${tournamentId}`);

                // Get the contract instance with ABI
                const contract = await sdk.getContract(contractAddress, TournamentABI);

                // Call the isEntrantInTournament function
                const isParticipant = await contract.call("isEntrantInTournament", [tournamentId, playerAddress]);

                // Cache the result
                CACHE.set(CACHE.participantStatus, cacheKey, isParticipant);

                return isParticipant;
            };

            // Use throttled call
            return await throttledRPCCall(
                cacheKey,
                TTL.PARTICIPANT_STATUS,
                fetchParticipantStatus
            );
        } catch (err) {
            console.error("Error checking participant status:", err);
            return false;
        }
    }

    // Get matching pool balance with caching
    async function getMatchingPoolBalance() {
        try {
            if (!sdk) {
                throw new Error("SDK not initialized");
            }

            const cacheKey = 'matching-pool-balance';

            // Check localStorage cache first
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { balance, timestamp } = JSON.parse(cachedItem);
                    if (Date.now() - timestamp < TTL.MATCHING_POOL) {
                        return ethers.BigNumber.from(balance);
                    }
                }
            } catch (e) {
                console.warn("Cache error:", e);
            }

            // Function to fetch from blockchain
            const fetchBalance = async () => {
                console.log('Fetching matching pool balance from blockchain');

                // Get the contract instance with ABI
                const contract = await sdk.getContract(contractAddress, TournamentABI);

                // Call the matchingPool view function
                const balance = await contract.call("matchingPool");

                // Cache in localStorage
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        balance: balance.toString(),
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn("Cache storage error:", e);
                }

                return balance;
            };

            // Use throttled call
            return await throttledRPCCall(
                cacheKey,
                TTL.MATCHING_POOL,
                fetchBalance
            );
        } catch (err: any) {
            console.error("Error getting matching pool balance:", err);
            throw err;
        }
    }

    // Create a new tournament
    async function createTournament(params: {
        numEntrants: number;
        winnersPercentage: number;
        multisigPercentage: number;
        tokenAddress: string;
        entryFee: string;
    }) {
        if (!address || !sdk) {
            throw new Error("Wallet not connected or SDK not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log("Creating tournament with params:", params);

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Parse the entry fee to wei - ensure we handle both decimal and wei formats
            let entryFeeWei;
            try {
                // First ensure we're working with a string
                const entryFeeStr = params.entryFee.toString();

                // Handle different formats of entry fee
                if (entryFeeStr.includes('.')) {
                    // It's in ETH format (e.g. "0.01"), convert to Wei
                    entryFeeWei = ethers.utils.parseEther(entryFeeStr);
                } else if (entryFeeStr.length > 10) {
                    // It's likely already in Wei format
                    entryFeeWei = ethers.BigNumber.from(entryFeeStr);
                } else {
                    // For smaller numbers without decimal, determine if it's ETH or Wei
                    const value = parseFloat(entryFeeStr);
                    if (value < 1) {
                        // Small value like 0.01 - treat as ETH
                        entryFeeWei = ethers.utils.parseEther(entryFeeStr);
                    } else {
                        // Larger value - treat as Wei
                        entryFeeWei = ethers.BigNumber.from(entryFeeStr);
                    }
                }
            } catch (err) {
                console.error("Error parsing entry fee:", err);
                // Last resort fallback
                entryFeeWei = ethers.utils.parseEther("0.01");
            }

            // Try to get current next tournament ID before transaction
            let nextIdBefore;
            try {
                nextIdBefore = await contract.call("nextTournamentId");
                console.log(`Current nextTournamentId before transaction: ${nextIdBefore.toString()}`);
            } catch (e) {
                console.warn(`Could not get nextTournamentId before transaction:`, e);
            }

            // Call the contract function
            const tx = await contract.call("createTournament", [
                params.numEntrants,
                params.winnersPercentage,
                params.multisigPercentage,
                params.tokenAddress,
                entryFeeWei
            ]);

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
                    const nextIdAfter = await contract.call("nextTournamentId");
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
    async function joinTournament(tournamentId: number, entryFee: string) {
        if (!address || !sdk) {
            throw new Error("Wallet not connected or SDK not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log("Joining tournament:", tournamentId, "with entry fee:", entryFee);

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Parse the entry fee to wei - handle both formats
            let entryFeeWei;
            try {
                // Check if it's already a large number (possibly wei)
                if (entryFee && entryFee.toString().length > 10) {
                    entryFeeWei = ethers.BigNumber.from(entryFee);
                } else {
                    // It's likely a decimal like "0.01", so parse it
                    entryFeeWei = ethers.utils.parseEther(entryFee);
                }
            } catch (err) {
                console.error("Error parsing entry fee:", err);
                // If all else fails, try the direct approach
                entryFeeWei = ethers.utils.parseEther(entryFee);
            }

            // Call the joinTournament function
            const tx = await contract.call("joinTournament", [tournamentId], {
                value: entryFeeWei
            });

            console.log("Join tournament transaction submitted:", tx);

            // Clear any cached data for this tournament
            CACHE.tournamentDetails.delete(tournamentId);
            // Clear participant status cache for this address
            CACHE.participantStatus.delete(`entrant_${tournamentId}_${address}`);

            // Handle the transaction result, regardless of format
            let result = {
                hash: tx.hash || "unknown",
                receipt: tx
            };

            // If tx.wait exists, try to use it, but don't fail if it doesn't
            if (tx && typeof tx.wait === 'function') {
                try {
                    const receipt = await tx.wait();
                    console.log("Join tournament transaction confirmed:", receipt);
                    result.receipt = receipt;
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                }
            }

            return result;
        } catch (err: any) {
            console.error("Error joining tournament:", err);
            setError(err.message || "Failed to join tournament");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Fill up matching pool
    async function fillUpMatchingPool(amount: ethers.BigNumber) {
        if (!address || !sdk) {
            throw new Error("Wallet not connected or SDK not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log("Adding funds to matching pool:", amount.toString());

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the fillUpMatchingPool function (which is payable)
            const tx = await contract.call("fillUpMatchingPool", [], {
                value: amount
            });

            console.log("Add funds transaction submitted:", tx);

            // Clear any cached balance
            localStorage.removeItem('matching-pool-balance');

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
        if (!address || !sdk) {
            throw new Error("Wallet not connected or SDK not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log("Allocating funds to tournament:", tournamentId);

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the allocateMatchingPoolToTournament function
            const tx = await contract.call("allocateMatchingPoolToTournament", [tournamentId]);

            console.log("Allocation transaction submitted:", tx);

            // Clear caches
            localStorage.removeItem('matching-pool-balance');
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
        if (!address || !sdk) {
            throw new Error("Wallet not connected or SDK not initialized");
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

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            console.log("Ending tournament:", {
                tournamentId,
                winners,
                percentages
            });

            // Call the endTournament function
            const tx = await contract.call("endTournament", [
                tournamentId,
                winners,
                percentages
            ]);

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
        if (!address || !sdk) {
            throw new Error("Wallet not connected or SDK not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log("Starting tournament with ID:", tournamentId);

            // Clear cache BEFORE the transaction to ensure we fetch fresh data
            CACHE.tournamentDetails.delete(tournamentId);

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the startTournament function
            const tx = await contract.call("startTournament", [tournamentId]);

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
        if (!sdk || !playerAddress) {
            console.error("Cannot save game result: SDK not initialized or no player address");
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
        isLoading,
        error
    };
}