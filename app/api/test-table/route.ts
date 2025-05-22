// app/api/test-table/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        // Get the table name from query parameters
        const { searchParams } = new URL(request.url);
        const table = searchParams.get('table');

        if (!table) {
            return NextResponse.json({
                success: false,
                error: 'Table name is required',
            }, { status: 400 });
        }

        // Test the table
        const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact' })
            .limit(5);

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message,
                details: error,
                table
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            table,
            count,
            sample: data,
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