// lib/tournamentDiagnostics.ts

/**
 * Helper function to diagnose Supabase tournament issues
 */
export async function diagnoseTournamentIssues() {
    const results = {
        environment: {},
        database: {
            connection: false,
            tables: {},
            error: null
        },
        api: {
            endpoints: {},
            error: null
        },
        contract: {
            address: null,
            connected: false,
            error: null
        }
    };

    try {
        // Check environment variables
        results.environment = {
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS: !!process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS,
        };

        // Check Supabase connection
        try {
            // We'll just try a simple query to test the connection
            const response = await fetch('/api/testConnection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'test_connection',
                    table: 'Tournament'
                })
            });

            const data = await response.json();
            results.database.connection = data.success || false;
            results.database.tables = data.tables || {};
            results.database.error = data.success ? null : data.error;
        } catch (err: any) {
            results.database.error = err.message;
        }

        // Check API endpoints
        try {
            // Test tournament endpoint with a GET request
            const tournamentResponse = await fetch('/api/tournament');
            results.api.endpoints['GET /api/tournament'] = tournamentResponse.ok;

            // Don't actually create a test tournament during diagnosis
            results.api.endpoints['POST /api/tournament'] = 'not tested';

            // Test room code endpoint
            try {
                const roomCodeResponse = await fetch(`/api/tournament/TEST123`);
                results.api.endpoints[`GET /api/tournament/[roomCode]`] = {
                    status: roomCodeResponse.status,
                    success: roomCodeResponse.ok
                };
            } catch (err: any) {
                results.api.endpoints[`GET /api/tournament/[roomCode]`] = {
                    status: 'error',
                    success: false,
                    error: err.message
                };
            }

        } catch (err: any) {
            results.api.error = err.message;
        }

        // Check contract connection
        results.contract.address = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS;

        return {
            success: true,
            results,
            timestamp: new Date().toISOString()
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            results,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Formats error messages for blockchain and database operations
 */
export function formatTournamentError(error: any): string {
    if (!error) return 'Unknown error';

    // Extract message from different error formats
    const message = error.message || error.reason || error.error || error;

    // Handle common blockchain errors
    if (typeof message === 'string') {
        // Insufficient funds errors
        if (message.includes('insufficient funds')) {
            return 'Insufficient funds to pay the transaction fee and entry fee';
        }

        // User rejected transaction
        if (message.includes('user rejected') || message.includes('User denied')) {
            return 'Transaction was rejected in your wallet';
        }

        // Transaction underpriced
        if (message.includes('underpriced')) {
            return 'Transaction underpriced. Try increasing gas price';
        }

        // Database errors
        if (message.includes('duplicate key')) {
            return 'This tournament already exists in the database';
        }

        if (message.includes('not found')) {
            return 'Tournament not found in the database';
        }

        // API key errors
        if (message.includes('API key')) {
            return 'Supabase API key issue. Check your environment variables';
        }

        // Tournament full
        if (message.includes('already full')) {
            return 'This tournament is already full';
        }

        // Entry fee parsing errors
        if (message.includes('invalid BigNumber')) {
            return 'Invalid entry fee format. Make sure it\'s a proper number like 0.01';
        }
    }

    return message.toString();
}

/**
 * Helper function to validate tournament parameters
 */
export function validateTournamentParams({
    entryFee,
    winnersPercentage,
    multisigPercentage,
    numEntrants
}: {
    entryFee: string;
    winnersPercentage: number;
    multisigPercentage: number;
    numEntrants: number;
}): { valid: boolean; error?: string } {
    // Check if entry fee is valid
    if (isNaN(parseFloat(entryFee)) || parseFloat(entryFee) <= 0) {
        return { valid: false, error: 'Entry fee must be greater than 0' };
    }

    // Check if winner percentage is valid
    if (winnersPercentage < 50 || winnersPercentage > 95) {
        return { valid: false, error: 'Winners percentage must be between 50 and 95' };
    }

    // Check if platform fee is valid
    if (multisigPercentage < 1 || multisigPercentage > 20) {
        return { valid: false, error: 'Platform fee must be between 1 and 20' };
    }

    // Check if totals to 100
    if (winnersPercentage + multisigPercentage > 100) {
        return { valid: false, error: 'Winners percentage and platform fee cannot exceed 100%' };
    }

    // Check if number of entrants is valid
    if (numEntrants < 2 || numEntrants > 100) {
        return { valid: false, error: 'Number of entrants must be between 2 and 100' };
    }

    return { valid: true };
}