import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    try {
        // Get recent winner payments
        const { data: payments, error } = await supabaseAdmin
            .from('winner_payments')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error fetching winner payments:', error);
            return NextResponse.json(
                { error: 'Failed to fetch winner payments' },
                { status: 500 }
            );
        }

        // Get tournament count
        const { count: tournamentCount, error: tournamentError } = await supabaseAdmin
            .from('Tournament')
            .select('*', { count: 'exact', head: true });

        // Get completed tournaments
        const { data: completedTournaments, error: completedError } = await supabaseAdmin
            .from('Tournament')
            .select('tournamentId, status, completed_at')
            .eq('status', 'COMPLETED')
            .order('completed_at', { ascending: false })
            .limit(5);

        return NextResponse.json({
            success: true,
            winnerPayments: {
                count: payments?.length || 0,
                recent: payments || [],
                error: error?.message
            },
            tournaments: {
                total: tournamentCount || 0,
                completed: completedTournaments || [],
                completedCount: completedTournaments?.length || 0
            },
            summary: {
                hasWinnerPayments: (payments?.length || 0) > 0,
                hasCompletedTournaments: (completedTournaments?.length || 0) > 0,
                lastPayment: payments?.[0] || null,
                lastCompletedTournament: completedTournaments?.[0] || null
            }
        });

    } catch (error) {
        console.error('Error in test-winner-payments:', error);
        return NextResponse.json(
            { error: 'Failed to test winner payments' },
            { status: 500 }
        );
    }
} 