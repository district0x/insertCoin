// app/api/test-supabase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase, testSupabaseConnection } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        // Get environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const tournamentContractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS;

        // Check environment variables
        const envCheck = {
            NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'defined' : 'undefined',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'defined (length: ' + supabaseAnonKey.length + ')' : 'undefined',
            NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS: tournamentContractAddress ? 'defined' : 'undefined'
        };

        // Test Supabase connection
        const connectionTest = await testSupabaseConnection();

        // Get all tables info if connection succeeded
        let tablesInfo = null;
        if (connectionTest.success) {
            try {
                const { data, error } = await supabase.from('Tournament').select('count');
                if (!error) {
                    tablesInfo = { Tournament: { accessible: true, count: data.length } };
                } else {
                    tablesInfo = { Tournament: { accessible: false, error: error.message } };
                }
            } catch (err: any) {
                tablesInfo = { error: err.message };
            }
        }

        // Return all the diagnostic info
        return NextResponse.json({
            timestamp: new Date().toISOString(),
            environment: envCheck,
            connection: connectionTest,
            tables: tablesInfo,
            supabaseInstance: {
                url: supabaseUrl
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}