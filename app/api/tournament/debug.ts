// Add this to api/tournament/debug.ts to check rate limiting and API state

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Import rate limiter from your tournament route if available
// import { requestCounts } from '../tournament/route'; // Uncomment if your rate limiter state is accessible

export async function GET(request: NextRequest) {
    try {
        const diagnosticInfo: any = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            endpoint: '/api/tournament/debug',
            headers: {},
            supabase: { connection: false, tables: {} },
            rateLimiter: { available: false }
        };

        // Get request headers (for CORS and other info)
        request.headers.forEach((value, key) => {
            // Filter out sensitive headers
            if (!['authorization', 'cookie'].includes(key.toLowerCase())) {
                diagnosticInfo.headers[key] = value;
            }
        });

        // Check Supabase connection
        try {
            const { data, error } = await supabaseAdmin
                .from('Tournament')
                .select('count')
                .limit(1);

            diagnosticInfo.supabase.connection = !error;
            diagnosticInfo.supabase.error = error ? error.message : null;
            diagnosticInfo.supabase.data = data;

            // Check specific tables
            const tables = ['Tournament', 'TournamentParticipant', 'GameResults'];
            for (const table of tables) {
                try {
                    const { error } = await supabaseAdmin
                        .from(table)
                        .select('count')
                        .limit(1);

                    diagnosticInfo.supabase.tables[table] = {
                        exists: !error,
                        error: error ? error.message : null
                    };
                } catch (e: any) {
                    diagnosticInfo.supabase.tables[table] = {
                        exists: false,
                        error: e.message
                    };
                }
            }
        } catch (e: any) {
            diagnosticInfo.supabase.error = e.message;
        }

        // Try to check rate limiter state - this will only work if you expose the requestCounts
        // Uncomment this if you have access to the rate limiter state
        /*
        try {
          diagnosticInfo.rateLimiter.available = true;
          diagnosticInfo.rateLimiter.activeIps = Array.from(requestCounts.keys()).length;
          diagnosticInfo.rateLimiter.nearLimit = Array.from(requestCounts.entries())
            .filter(([_, data]) => data.count > (MAX_REQUESTS * 0.7))
            .map(([ip, data]) => ({
              ip: ip.substring(0, 3) + '***', // Hide full IP for privacy
              count: data.count,
              resetTime: new Date(data.resetTime).toISOString()
            }));
        } catch (e) {
          diagnosticInfo.rateLimiter.error = "Cannot access rate limiter data";
        }
        */

        // Return diagnostic info
        return NextResponse.json({
            success: true,
            diagnostics: diagnosticInfo
        });
    } catch (error: any) {
        console.error('Server diagnostic error:', error);
        return NextResponse.json(
            { error: `Server diagnostic error: ${error.message}` },
            { status: 500 }
        );
    }
}