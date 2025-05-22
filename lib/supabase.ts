// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials, validateEnvironment } from './environmentHelper';

// Validate environment variables and get clean credentials
const { url: supabaseUrl, key: supabaseKey } = getSupabaseCredentials();
const envValidation = validateEnvironment();

// Debug logging for environment issues
if (!envValidation.valid) {
    console.error('Environment validation failed:');
    const issues = Object.entries(envValidation.variables)
        .filter(([_, info]) => info.status !== 'ok')
        .map(([name, info]) => `${name}: ${info.status}`);

    console.error(`Issues found: ${issues.join(', ')}`);
}

// Create the Supabase client with proper error handling
let supabaseClient;
try {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false, // for server components, don't persist
            autoRefreshToken: false
        }
    });

    console.log('Supabase client initialized successfully');
} catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    // Create a dummy client that will throw errors when used
    supabaseClient = {
        from: () => {
            throw new Error('Supabase client not properly initialized');
        }
    } as any;
}

// Export the client
export const supabase = supabaseClient;

// Export a function to test the connection
export async function testSupabaseConnection() {
    try {
        // First, log the credentials being used (without revealing full key)
        console.log(`Testing Supabase connection to: ${supabaseUrl}`);
        console.log(`Using key: ${supabaseKey.substring(0, 10)}...`);

        // Try a simple query
        const { data, error } = await supabase
            .from('Tournament')
            .select('count')
            .limit(1);

        if (error) {
            console.error('Supabase connection test failed:', error);
            return {
                success: false,
                error: error.message,
                details: error,
                credentialsUsed: {
                    url: supabaseUrl,
                    keyPrefix: supabaseKey.substring(0, 10) + '...'
                }
            };
        }

        return {
            success: true,
            data,
            credentialsUsed: {
                url: supabaseUrl,
                keyPrefix: supabaseKey.substring(0, 10) + '...'
            }
        };
    } catch (err: any) {
        console.error('Supabase connection test exception:', err);
        return {
            success: false,
            error: err.message,
            details: err,
            credentialsUsed: {
                url: supabaseUrl,
                keyPrefix: supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'undefined'
            }
        };
    }
}