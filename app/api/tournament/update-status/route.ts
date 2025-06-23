import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { tournamentId, status } = await request.json();

        if (!tournamentId || !status) {
            return NextResponse.json(
                { error: 'Tournament ID and status are required' },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['FILLING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be one of: FILLING, ACTIVE, COMPLETED, CANCELLED' },
                { status: 400 }
            );
        }

        // Update tournament status
        const { data, error } = await supabaseAdmin
            .from('Tournament')
            .update({
                status: status,
                updatedAt: new Date().toISOString()
            })
            .eq('tournamentId', tournamentId)
            .select()
            .single();

        if (error) {
            console.error('Error updating tournament status:', error);
            return NextResponse.json(
                { error: `Failed to update tournament status: ${error.message}` },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'Tournament not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Tournament ${tournamentId} status updated to ${status}`,
            tournament: data
        });

    } catch (error) {
        console.error('Error in update-status API:', error);
        return NextResponse.json(
            { error: 'Failed to update tournament status' },
            { status: 500 }
        );
    }
} 