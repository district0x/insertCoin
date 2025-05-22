// app/api/testConnection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const { action, table } = await request.json();

        // Gather information about Supabase connection and tables
        let tables = [];
        let tableData = {};
        let success = false;

        // Test connection by performing a simple query
        if (action === 'test_connection') {
            try {
                // First try to get all tables
                const { data: tablesData, error: tablesError } = await supabase
                    .from(table)
                    .select('count(*)')
                    .limit(1);

                if (!tablesError) {
                    success = true;

                    // Now try to get info about specific tables
                    const tablesToCheck = ['Tournament', 'TournamentParticipant', 'TournamentResults'];

                    for (const tableName of tablesToCheck) {
                        try {
                            const { count, error } = await supabase
                                .from(tableName)
                                .select('*', { count: 'exact', head: true });

                            tableData[tableName] = {
                                exists: !error,
                                count: count || 0,
                                error: error ? error.message : null
                            };
                        } catch (err: any) {
                            tableData[tableName] = {
                                exists: false,
                                count: 0,
                                error: err.message
                            };
                        }
                    }
                } else {
                    throw new Error(`Failed to query '${table}': ${tablesError.message}`);
                }
            } catch (err: any) {
                return NextResponse.json({
                    success: false,
                    error: err.message,
                    tables: [],
                    tableData: {}
                });
            }
        }

        return NextResponse.json({
            success,
            tables,
            tableData,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}