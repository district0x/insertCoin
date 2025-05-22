// lib/environmentHelper.ts

/**
 * Validates environment variables and provides diagnostic information
 */
export function validateEnvironment() {
    // These are variables used by your app
    const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS',
        'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
    ];

    const results: Record<string, {
        defined: boolean;
        value?: string;
        length?: number;
        truncated?: string;
        status: 'ok' | 'missing' | 'malformed';
    }> = {};

    // Check each required variable
    for (const varName of requiredVars) {
        const value = process.env[varName];

        if (!value) {
            results[varName] = {
                defined: false,
                status: 'missing'
            };
            continue;
        }

        // Special checks for specific variables
        let status: 'ok' | 'missing' | 'malformed' = 'ok';

        if (varName === 'NEXT_PUBLIC_SUPABASE_URL') {
            // Supabase URL should be a valid URL
            try {
                new URL(value);
            } catch (e) {
                status = 'malformed';
            }
        }
        else if (varName === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
            // Supabase key should be a JWT token (starts with ey)
            if (!value.startsWith('ey') || value.length < 20) {
                status = 'malformed';
            }
        }
        else if (varName.includes('ADDRESS')) {
            // Address should be 42 chars (0x + 40 hex chars)
            if (!value.startsWith('0x') || value.length !== 42) {
                status = 'malformed';
            }
        }

        results[varName] = {
            defined: true,
            length: value.length,
            truncated: varName.includes('KEY') ?
                `${value.substring(0, 10)}...${value.substring(value.length - 4)}` :
                value,
            status
        };
    }

    // Check for critical failures
    const hasCriticalFailure = Object.values(results).some(r =>
        r.status === 'missing' || r.status === 'malformed'
    );

    return {
        valid: !hasCriticalFailure,
        variables: results
    };
}

/**
 * Returns properly formatted Supabase credentials
 * This helps avoid common issues with whitespace or quotes in .env values
 */
export function getSupabaseCredentials() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Trim whitespace and quotes that might be accidentally included in .env
    const cleanUrl = url.trim().replace(/^['"]|['"]$/g, '');
    const cleanKey = key.trim().replace(/^['"]|['"]$/g, '');

    return {
        url: cleanUrl,
        key: cleanKey
    };
}