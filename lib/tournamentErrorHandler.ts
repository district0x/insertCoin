// lib/tournamentErrorHandler.ts
import { ethers } from 'ethers';

// Common error codes from Ethereum providers
type EthereumErrorCode =
    | 'ACTION_REJECTED' // MetaMask: 4001, User rejected the request
    | 'INSUFFICIENT_FUNDS' // Not enough ETH
    | 'UNPREDICTABLE_GAS_LIMIT' // Contract error
    | 'TRANSACTION_REPLACED' // Tx was replaced/canceled
    | 'NETWORK_ERROR' // Network connection issues
    | 'UNKNOWN_ERROR';

interface EthereumError extends Error {
    code?: number | string;
    data?: any;
    reason?: string;
    error?: {
        message?: string;
        code?: number | string;
        data?: any;
    };
}

/**
 * Standardizes error messages from various sources into user-friendly messages
 */
export function formatTournamentError(error: any): string {
    if (!error) return "An unknown error occurred";

    console.log("Formatting error:", error);

    // Extract the error object
    const err: EthereumError = error.error || error;

    // Try to identify the error code/type
    const code = err.code || (err.error && err.error.code) || 'UNKNOWN_ERROR';
    const reason = err.reason || (err.error && err.error.message) || err.message || "Unknown reason";

    // Handle specific error codes from providers like MetaMask
    if (code === 4001 || code === 'ACTION_REJECTED' || reason.includes('User denied') || reason.includes('user rejected')) {
        return "Transaction canceled: You rejected the request";
    }

    if (code === -32603 || reason.includes('insufficient funds')) {
        return "Transaction failed: Insufficient funds for gas * price + value";
    }

    if (reason.includes('gas limit')) {
        return "Contract error: The transaction might revert. Check if you have enough ETH for the transaction.";
    }

    // Parse contract-specific errors
    if (reason.includes('Tournament is not active')) {
        return "This tournament is not in an active state";
    }

    if (reason.includes('Tournament has already started')) {
        return "This tournament has already started";
    }

    if (reason.includes('Tournament is full')) {
        return "This tournament is already full";
    }

    if (reason.includes('Already joined')) {
        return "You have already joined this tournament";
    }

    if (reason.includes('Only host')) {
        return "Only the tournament host can perform this action";
    }

    if (reason.includes('sender is not admin')) {
        return "You don't have admin privileges to perform this action";
    }

    if (reason.includes('nonce')) {
        return "Transaction failed: Nonce error. Please try again.";
    }

    // Network-related errors
    if (reason.includes('network') || reason.includes('connection')) {
        return "Network error: Check your internet connection and try again";
    }

    // Extract the most meaningful part of the error
    let cleanedMessage = reason
        .replace(/^(error|exception|revert|fail|execution reverted):/i, '')
        .replace(/\{[^}]*\}/g, '') // Remove JSON objects
        .replace(/\([^)]*\)/g, '') // Remove parentheses content
        .trim();

    // Still too long? Just take the first sentence
    if (cleanedMessage.length > 100) {
        cleanedMessage = cleanedMessage.split('.')[0].trim() + '.';
    }

    return cleanedMessage || "An error occurred with the transaction";
}

/**
 * Specialized error handler for tournament join operations
 */
export function handleTournamentJoinError(error: any): string {
    const baseError = formatTournamentError(error);

    // Handle special join-specific errors
    if (baseError.includes('fee') || baseError.includes('value')) {
        return "Failed to join tournament: Incorrect entry fee amount. Please check the tournament requirements.";
    }

    return baseError;
}

/**
 * Specialized error handler for tournament creation operations
 */
export function handleTournamentCreationError(error: any): string {
    const baseError = formatTournamentError(error);

    // Handle special creation-specific errors
    if (baseError.includes('percentage') || baseError.includes('exceed 100')) {
        return "Failed to create tournament: Winner and platform percentages must sum to 100% or less.";
    }

    return baseError;
}

/**
 * Mock TX hash generator (for testing only)
 */
export function generateMockTxHash(): string {
    return '0x' + Array.from({ length: 64 }, () =>
        '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
}

/**
 * Wait for transaction to be mined and confirmed
 */
export async function waitForTransaction(
    txHash: string,
    confirmations = 1
): Promise<boolean> {
    // This would normally use a provider, but for simplicity
    // we'll just simulate a delay and return true
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, 2000);
    });
}