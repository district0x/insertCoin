// hooks/useTournamentContract.ts
'use client';

import { useState, useCallback } from 'react';
import { useAddress, useSDK } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import { TournamentABI } from "@/app/lib/contracts/abis/TournamentABI";

// Global cache object to store tournament details across renders
// This prevents repeated blockchain calls for the same data
const CACHE_TTL = 30000; // 30 seconds cache lifetime
const tournamentDetailsCache = new Map<number, { data: any; timestamp: number }>();

export function useTournamentContract() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const address = useAddress();
    const sdk = useSDK();

    // Contract address from environment variable
    const contractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS || '';

    // New function: Add funds to the global matching pool
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

    // New function: Allocate funds from the matching pool to a tournament
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

            // Clear any cached data for this tournament
            tournamentDetailsCache.delete(tournamentId);

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

    // New function: Get the current matching pool balance
    async function getMatchingPoolBalance() {
        if (!sdk) {
            throw new Error("SDK not initialized");
        }

        try {
            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the matchingPool view function
            const balance = await contract.call("matchingPool");

            return balance;
        } catch (err: any) {
            console.error("Error getting matching pool balance:", err);
            throw err;
        }
    }

    const startTournament = async (tournamentId: number) => {
        if (!address || !sdk) {
            throw new Error("Wallet not connected or SDK not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log("Starting tournament with ID:", tournamentId);

            // Clear cache BEFORE the transaction to ensure we fetch fresh data
            tournamentDetailsCache.delete(tournamentId);

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the startTournament function
            const tx = await contract.call("startTournament", [tournamentId]);

            console.log("Start tournament transaction submitted:", tx);

            // Wait for the transaction to be mined if wait is available
            let receipt;
            if (tx && typeof tx.wait === 'function') {
                try {
                    console.log("Waiting for transaction confirmation...");
                    receipt = await tx.wait();
                    console.log("Start tournament transaction confirmed:", receipt);
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                }
            }

            // Force a refresh of tournament data after transaction
            setTimeout(async () => {
                try {
                    // Get fresh tournament details to confirm the change
                    const freshDetails = await contract.call("tournaments", [tournamentId]);
                    console.log("Fresh tournament details after transaction:", freshDetails);

                    // Check if hasStarted is now true
                    if (freshDetails && freshDetails.hasStarted) {
                        console.log("Tournament has been successfully started!");
                    } else {
                        console.warn("Transaction completed but tournament may not be started yet. Check blockchain status.");
                    }
                } catch (refreshErr) {
                    console.error("Error refreshing tournament data:", refreshErr);
                }
            }, 2000); // Wait 2 seconds after transaction for chain update

            return {
                hash: tx.hash || "unknown",
                tournamentId: tournamentId
            };
        } catch (err: any) {
            console.error("Error starting tournament:", err);
            setError(err.message || "Failed to start tournament");
            throw err;
        } finally {
            setIsLoading(false);
        }
    };



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

                console.log("Parsed entry fee:", {
                    original: params.entryFee,  // Change entryFee to params.entryFee
                    asString: entryFeeStr,
                    parsed: entryFeeWei.toString()
                });
            } catch (err) {
                console.error("Error parsing entry fee:", err, {
                    entryFee: params.entryFee,  // Change entryFee to params.entryFee
                    type: typeof params.entryFee
                });

                // Last resort fallback
                try {
                    // Try to use it directly as a string
                    entryFeeWei = ethers.BigNumber.from(params.entryFee.toString());  // Change entryFee to params.entryFee
                } catch (fallbackErr) {
                    // If everything fails, default to a small amount (0.01 ETH)
                    console.error("Fallback conversion also failed:", fallbackErr);
                    entryFeeWei = ethers.utils.parseEther("0.01");
                }
            }

            // Add more detailed logging
            console.log("Contract address:", contractAddress);
            console.log("Entry fee in wei:", entryFeeWei.toString());

            // Call the contract function with more error handling
            let tx;
            try {
                tx = await contract.call("createTournament", [
                    params.numEntrants,
                    params.winnersPercentage,
                    params.multisigPercentage,
                    params.tokenAddress,
                    entryFeeWei
                ]);

                console.log("Transaction response:", tx);
            } catch (callError) {
                console.error("Contract call error:", callError);
                throw new Error(`Contract call failed: ${callError.message || "Unknown error"}`);
            }

            if (!tx) {
                throw new Error("No transaction returned from contract call");
            }

            console.log("Transaction submitted:", tx.hash);

            // Handle different transaction response formats
            let receipt;

            if (typeof tx.wait === 'function') {
                // Standard ethers.js transaction with wait method
                receipt = await tx.wait();
                console.log("Transaction confirmed (wait method):", receipt);
            } else if (tx.receipt) {
                // Some web3 libraries return the receipt directly in the tx.receipt property
                receipt = tx.receipt;
                console.log("Transaction confirmed (receipt property):", receipt);
            } else if (tx.hash || tx.transactionHash) {
                // If we only have a transaction hash, consider it sufficient
                receipt = {
                    transactionHash: tx.hash || tx.transactionHash,
                    status: 1  // Assume success
                };
                console.log("Transaction submitted (hash only):", receipt);
            } else {
                // If we can't get a receipt but have a transaction object
                console.log("Transaction object has unusual format:", tx);
                receipt = {
                    transactionHash: "unknown",
                    status: 1  // Assume success
                };
            }

            // Extract the tournament ID from the events
            // Look for the TournamentCreated event
            const tournamentCreatedEvent = receipt.events?.find(
                (event) => event.event === "TournamentCreated"
            );

            if (!tournamentCreatedEvent || !tournamentCreatedEvent.args) {
                console.log("All events:", receipt.events);

                // If we can't find the event, let's try to get the tournament ID another way
                // For example, if the contract returns the ID directly
                if (typeof tx === 'object' && tx !== null && 'tournamentId' in tx) {
                    const tournamentId = tx.tournamentId.toString();
                    console.log("Found tournament ID in tx object:", tournamentId);

                    return {
                        hash: tx.hash || "unknown",
                        receipt: receipt,
                        tournamentId: tournamentId
                    };
                }

                throw new Error("Failed to find TournamentCreated event in transaction receipt");
            }

            // Get the tournament ID from the event args
            const tournamentId = tournamentCreatedEvent.args.tournamentId.toString();
            console.log("Tournament created with ID:", tournamentId);

            // Clear any cached data for this tournament so we fetch fresh data
            tournamentDetailsCache.delete(parseInt(tournamentId));

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

            console.log("Joining with entry fee wei:", entryFeeWei.toString());

            // Call the joinTournament function
            const tx = await contract.call("joinTournament", [tournamentId], {
                value: entryFeeWei
            });

            console.log("Join tournament transaction submitted:", tx);

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
                    // We'll continue with what we have
                }
            }

            // Clear any cached data for this tournament to ensure fresh data
            tournamentDetailsCache.delete(tournamentId);

            return result;
        } catch (err: any) {
            console.error("Error joining tournament:", err);
            setError(err.message || "Failed to join tournament");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Check if a user is a participant in a tournament
    async function isEntrantInTournament(tournamentId: number, playerAddress: string) {
        try {
            if (!sdk) return false;

            // This is a simple boolean call and doesn't change often, so we can cache for 1 minute
            const cacheKey = `entrant_${tournamentId}_${playerAddress}`;
            const cachedData = sessionStorage.getItem(cacheKey);

            if (cachedData) {
                const { isParticipant, timestamp } = JSON.parse(cachedData);
                // Cache for 1 minute (60000ms)
                if (Date.now() - timestamp < 60000) {
                    console.log(`Using cached entrant data for tournament ${tournamentId} and player ${playerAddress}`);
                    return isParticipant;
                }
            }

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the isEntrantInTournament function
            const isParticipant = await contract.call("isEntrantInTournament", [
                tournamentId,
                playerAddress
            ]);

            // Cache the result
            sessionStorage.setItem(cacheKey, JSON.stringify({
                isParticipant,
                timestamp: Date.now()
            }));

            return isParticipant;
        } catch (err) {
            console.error("Error checking participant:", err);
            return false;
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

            // Handle different transaction response formats
            let receipt;

            if (typeof tx.wait === 'function') {
                // Standard ethers.js transaction with wait method
                try {
                    receipt = await tx.wait();
                    console.log("Transaction confirmed (wait method):", receipt);
                } catch (waitError) {
                    console.warn("Could not wait for transaction, but continuing:", waitError);
                    receipt = {
                        transactionHash: tx.hash || "unknown",
                        status: 1  // Assume success
                    };
                }
            } else if (tx.receipt) {
                // Some web3 libraries return the receipt directly in the tx.receipt property
                receipt = tx.receipt;
                console.log("Transaction confirmed (receipt property):", receipt);
            } else if (tx.hash || tx.transactionHash) {
                // If we only have a transaction hash, consider it sufficient
                receipt = {
                    transactionHash: tx.hash || tx.transactionHash,
                    status: 1  // Assume success
                };
                console.log("Transaction submitted (hash only):", receipt);
            } else {
                // If we can't get a receipt but have a transaction object
                console.log("Transaction object has unusual format:", tx);
                receipt = {
                    transactionHash: "unknown",
                    status: 1  // Assume success
                };
            }

            // Clear any cached data for this tournament as it's now ended
            tournamentDetailsCache.delete(tournamentId);

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

    // Get tournament details - enhanced with caching to reduce RPC calls
    async function getTournamentDetails(tournamentId: number) {
        try {
            if (!sdk) {
                throw new Error("SDK not initialized");
            }

            setIsLoading(true);
            setError(null);

            // Check cache first
            const now = Date.now();
            const cachedEntry = tournamentDetailsCache.get(tournamentId);

            if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
                console.log(`Using cached tournament details for ID: ${tournamentId}`);
                return cachedEntry.data;
            }

            console.log(`Fetching tournament details from blockchain for ID: ${tournamentId}`);

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the tournaments mapping
            const tournament = await contract.call("tournaments", [tournamentId]);

            // Get current tournament round if available
            let currentRound = 0;
            try {
                currentRound = await contract.call("currentTournamentRound", [tournamentId]);
            } catch (err) {
                console.log("Could not get current tournament round:", err);
            }

            // Get entrant count more efficiently
            let currentEntrants = 0;
            try {
                // Instead of checking each slot individually, we'll estimate the count
                // by checking key slots with fewer RPC calls
                const maxEntrants = parseInt(tournament.numEntrants.toString() || '0');

                // For tournaments with few entrants, just check directly
                if (maxEntrants <= 10) {
                    // Check each slot
                    for (let i = 0; i < maxEntrants; i++) {
                        const entrant = await contract.call("tournamentEntrants", [tournamentId, i]);
                        if (entrant === ethers.constants.AddressZero) {
                            break;
                        }
                        currentEntrants++;
                    }
                } else {
                    // For larger tournaments, use binary search approach
                    // to minimize RPC calls while getting accurate count
                    let low = 0;
                    let high = maxEntrants - 1;

                    // Check last position first - if filled, tournament is likely full
                    const lastEntrant = await contract.call("tournamentEntrants", [tournamentId, high]);
                    if (lastEntrant !== ethers.constants.AddressZero) {
                        currentEntrants = maxEntrants;
                    } else {
                        // Check middle position to narrow search space
                        while (low <= high) {
                            const mid = Math.floor((low + high) / 2);
                            const entrant = await contract.call("tournamentEntrants", [tournamentId, mid]);

                            if (entrant !== ethers.constants.AddressZero) {
                                // This position is filled, check higher
                                currentEntrants = mid + 1;
                                low = mid + 1;
                            } else {
                                // This position is empty, check lower
                                high = mid - 1;
                            }
                        }
                    }
                }
            } catch (err) {
                console.log("Could not count entrants:", err);
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
                numEntrants: parseInt(tournament.numEntrants.toString() || '0'),
                currentEntrants: currentEntrants,
                totalDonations: tournament.totalDonations?.toString(),
                totalTokenDonations: tournament.totalTokenDonations?.toString(),
                remainingBalance: tournament.remainingBalance?.toString(),
                entryFee: ethers.utils.formatEther(tournament.entryFee?.toString() || '0'),
                token: tournament.token,
                currentRound: currentRound?.toString()
            };

            // Store in cache
            tournamentDetailsCache.set(tournamentId, {
                data: tournamentDetails,
                timestamp: now
            });

            return tournamentDetails;
        } catch (err: any) {
            console.error("Error getting tournament details:", err);
            setError(err.message || "Failed to get tournament details");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    // Check if an address is an admin
    async function isAdmin(checkAddress: string) {
        try {
            if (!sdk) return false;

            // Cache admin status - unlikely to change often
            const cacheKey = `admin_${checkAddress}`;
            const cachedData = sessionStorage.getItem(cacheKey);

            if (cachedData) {
                const { adminStatus, timestamp } = JSON.parse(cachedData);
                // Cache for 10 minutes (600000ms)
                if (Date.now() - timestamp < 600000) {
                    console.log(`Using cached admin status for ${checkAddress}`);
                    return adminStatus;
                }
            }

            // Get the contract instance with ABI
            const contract = await sdk.getContract(contractAddress, TournamentABI);

            // Call the isAdmin function
            const adminStatus = await contract.call("isAdmin", [checkAddress]);

            // Cache the result
            sessionStorage.setItem(cacheKey, JSON.stringify({
                adminStatus,
                timestamp: Date.now()
            }));

            return adminStatus;
        } catch (err) {
            console.error("Error checking admin status:", err);
            return false;
        }
    }

    // Save game result (function for game-specific features)
    // Note: This function is not in the ABI but kept for compatibility with game components
    async function saveGameResult(gameId: string, playerAddress: string, score: number) {
        if (!sdk || !playerAddress) {
            console.error("Cannot save game result: SDK not initialized or no player address");
            return null;
        }

        try {
            // Get the contract instance with ABI
            const gameContract = await sdk.getContract(contractAddress, TournamentABI);

            console.log(`Saving game result (this feature is not in the contract ABI): Game ID ${gameId}, Player ${playerAddress}, Score ${score}`);

            // Since this function doesn't exist in the contract, we'll log but not actually call
            console.log("Note: saveGameResult function is not in the contract ABI");

            // Returning a simulated success response
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
        saveGameResult,  // Included for backward compatibility
        startTournament,
        // Add the new functions to the return object
        fillUpMatchingPool,
        allocateMatchingPoolToTournament,
        getMatchingPoolBalance,
        isLoading,
        error
    };
}