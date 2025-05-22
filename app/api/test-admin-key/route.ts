// app/api/test-admin-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
    try {
        // Check if service role key is available
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Check URL is available
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        // Print the first 10 characters of the service key for debugging
        const keyInfo = serviceKey
            ? `Key is set (length: ${serviceKey.length}, starts with: ${serviceKey.substring(0, 10)}...)`
            : 'Key is NOT set';

        // Try a simple query to test if the admin client works
        const { data, error } = await supabaseAdmin
            .from('Tournament')
            .select('count')
            .limit(1);

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message,
                environment: {
                    serviceKey: keyInfo,
                    supabaseUrl: supabaseUrl || 'Not set'
                }
            }, { status: 500 });
        }

        // Try an insert and delete to fully test admin permissions
        const testRecord = {
            roomCode: `test-${Date.now()}`,
            tournamentId: `test-${Date.now()}`,
            maxParticipants: 1,
            entryFee: '0',
            totalPrize: 0,
            status: 'TEST',
        };

        const { data: insertData, error: insertError } = await supabaseAdmin
            .from('Tournament')
            .insert([testRecord])
            .select();

        let writeTest = { success: false, error: null };

        if (insertError) {
            writeTest.error = insertError.message;
        } else {
            // Successfully inserted, now delete it
            const { error: deleteError } = await supabaseAdmin
                .from('Tournament')
                .delete()
                .eq('roomCode', testRecord.roomCode);

            if (deleteError) {
                writeTest.error = deleteError.message;
            } else {
                writeTest.success = true;
            }
        }

        return NextResponse.json({
            success: true,
            environment: {
                serviceKey: keyInfo,
                supabaseUrl: supabaseUrl || 'Not set'
            },
            readTest: {
                success: true,
                data
            },
            writeTest
        });
    } catch (error: any) {
        console.error('Test admin key error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}