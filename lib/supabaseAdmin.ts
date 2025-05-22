import { createClient } from '@supabase/supabase-js';

// Handle the case where this file is imported in both server and client environments
const isServer = typeof window === 'undefined';

// Create a function that safely initializes the Supabase admin client
function initSupabaseAdmin() {
    try {
        // Get the environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Only log in server environment
        if (isServer) {
            // Log environment info but handle missing console
            if (!supabaseUrl) {
                console.warn('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
            }

            if (!supabaseServiceKey) {
                console.warn('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. This is required for API routes that write to Supabase.');
            }

            console.log(`Admin client initializing with URL: ${supabaseUrl || 'undefined'}`);
            console.log(`Service role key available: ${supabaseServiceKey ? 'Yes' : 'No'}`);
            if (supabaseServiceKey) {
                console.log(`Service key starts with: ${supabaseServiceKey.substring(0, 10)}...`);
            }
        }

        // Create the client
        return createClient(
            supabaseUrl || '',
            supabaseServiceKey || '',
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );
    } catch (error) {
        // Handle initialization errors
        if (isServer) {
            console.error('Failed to initialize Supabase admin client:', error);
        }

        // Return a mock client when initialization fails
        // This prevents runtime errors when the client is used
        return {
            from: () => ({
                select: () => ({ data: null, error: new Error('Supabase admin client failed to initialize') }),
                insert: () => ({ data: null, error: new Error('Supabase admin client failed to initialize') }),
                update: () => ({ data: null, error: new Error('Supabase admin client failed to initialize') }),
                delete: () => ({ data: null, error: new Error('Supabase admin client failed to initialize') }),
                upsert: () => ({ data: null, error: new Error('Supabase admin client failed to initialize') }),
            }),
            // Add other commonly used methods as needed
            auth: {
                getUser: async () => ({ data: { user: null }, error: new Error('Supabase admin client failed to initialize') }),
            },
            storage: {
                from: () => ({
                    upload: async () => ({ data: null, error: new Error('Supabase admin client failed to initialize') }),
                    download: async () => ({ data: null, error: new Error('Supabase admin client failed to initialize') }),
                }),
            },
        } as any;
    }
}

// Initialize the admin client
const supabaseAdmin = initSupabaseAdmin();

// Export the client
export { supabaseAdmin };