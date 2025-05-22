// app/api/test-admin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, testAdminConnection } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
    try {
        // Check environment variables
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        // Test connection with admin client
        const connectionTest = await testAdminConnection();

        // Try an INSERT and DELETE to verify full access
        let writeTest = { success: false, error: null };

        if (connectionTest.success) {
            try {
                // Test insert with a temporary record
                const testId = `test-${Date.now()}`;

                const { error: insertError } = await supabaseAdmin
                    .from('Tournament')
                    .insert([{
                        roomCode: testId,
                        tournamentId: testId,
                        maxParticipants: 1,
                        entryFee: '0',
                        totalPrize: 0,
                        status: 'TEST',
                        currentParticipants: 0
                    }]);

                if (insertError) {
                    writeTest.error = `Insert error: ${insertError.message}`;
                } else {
                    // Successfully inserted, now delete
                    const { error: deleteError } = await supabaseAdmin
                        .from('Tournament')
                        .delete()
                        .eq('roomCode', testId);

                    if (deleteError) {
                        writeTest.error = `Delete error: ${deleteError.message}`;
                    } else {
                        writeTest.success = true;
                    }
                }
            } catch (err: any) {
                writeTest.error = `Exception: ${err.message}`;
            }
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            adminConfig: {
                serviceRoleKey: serviceRoleKey ? 'defined (length: ' + serviceRoleKey.length + ')' : 'undefined',
                supabaseUrl: supabaseUrl || 'undefined'
            },
            adminConnection: connectionTest,
            writePermissionTest: writeTest
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}