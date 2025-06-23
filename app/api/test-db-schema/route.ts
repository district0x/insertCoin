import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    try {
        // Test the TournamentParticipant table structure
        const { data, error } = await supabaseAdmin
            .from('TournamentParticipant')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error testing TournamentParticipant table:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Get the column names from the first row
        const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

        return NextResponse.json({
            success: true,
            columns,
            sampleData: data && data.length > 0 ? data[0] : null,
            tableExists: true
        });
    } catch (error) {
        console.error('Error in test-db-schema:', error);
        return NextResponse.json({ error: 'Failed to test database schema' }, { status: 500 });
    }
} 