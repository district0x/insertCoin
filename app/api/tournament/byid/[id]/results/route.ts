import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: tournamentId } = await params;
        const { winners, txHash } = await request.json();

        if (!winners || !Array.isArray(winners)) {
            return NextResponse.json(
                { error: 'Winners array is required' },
                { status: 400 }
            );
        }

        // Update tournament status
        const { data, error } = await supabaseAdmin
            .from('Tournament')
            .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString()
            })
            .eq('tournamentId', tournamentId)
            .select()
            .single();

        if (error) {
            console.error('Error updating tournament results:', error);
            return NextResponse.json(
                { error: 'Failed to update tournament results' },
                { status: 500 }
            );
        }

        // Update participant records to mark winners
        for (let i = 0; i < winners.length; i++) {
            const winner = winners[i];
            try {
                await supabaseAdmin
                    .from('TournamentParticipant')
                    .update({
                        is_winner: true,
                        prize_amount: winner.amount || '0'
                    })
                    .eq('tournamentid', tournamentId)
                    .eq('walletaddress', winner.address);
            } catch (err) {
                console.warn(`Warning: Failed to update participant status for ${winner.address}`, err);
                // Continue with other winners even if one update fails
            }
        }

        // ADDITION: Insert records into winner_payments for reliability
        try {
            const { data: tournamentData } = await supabaseAdmin
                .from('Tournament')
                .select('totalPrize, tokenAddress')
                .eq('tournamentId', tournamentId)
                .single();

            if (tournamentData) {
                const winnerPaymentRecords = winners.map(winner => ({
                    tournament_id: tournamentId,
                    winner_address: winner.address,
                    winner_name: winner.name,
                    amount: winner.amount || '0',
                    percentage: winner.percentage,
                    token_address: tournamentData.tokenAddress,
                    transaction_hash: txHash,
                    game_type: 'tournament',
                    total_prize_pool: tournamentData.totalPrize,
                }));

                const { error: paymentError } = await supabaseAdmin
                    .from('winner_payments')
                    .insert(winnerPaymentRecords);

                if (paymentError) {
                    console.error('Error inserting into winner_payments:', paymentError);
                    // Non-fatal: Log error but don't block the response
                }
            }
        } catch (paymentInsertError) {
            console.error('Failed to prepare or insert winner payments:', paymentInsertError);
        }

        // Insert results into game history/leaderboard
        try {
            await supabaseAdmin
                .from('GameResults')
                .insert([{
                    tournamentId,
                    timestamp: new Date().toISOString(),
                    players: winners.map((winner, index) => ({
                        name: winner.name || 'Anonymous',
                        score: winner.score || 0,
                        address: winner.address,
                        rank: index + 1
                    })),
                    gameSettings: {
                        isTournament: true,
                        tournamentId
                    }
                }]);
        } catch (gameResultsError) {
            console.warn('Warning: Failed to add game results', gameResultsError);
            // Continue even if game results insert fails
        }

        return NextResponse.json({
            success: true,
            tournament: data
        });
    } catch (error) {
        console.error('Error updating tournament results:', error);
        return NextResponse.json(
            { error: 'Failed to update tournament results' },
            { status: 500 }
        );
    }
}

// Get tournament results by tournamentId
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: tournamentId } = await params;

        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabaseAdmin
            .from('Tournament')
            .select('*')
            .eq('tournamentId', tournamentId)
            .single();

        if (tournamentError) {
            console.error('Error fetching tournament results:', tournamentError);
            return NextResponse.json(
                { error: 'Failed to fetch tournament results' },
                { status: 500 }
            );
        }

        // Get winners if available
        let winners = [];
        if (tournament.winnerAddresses && tournament.winnerAddresses.length > 0) {
            const { data: winnerParticipants, error: winnersError } = await supabaseAdmin
                .from('TournamentParticipant')
                .select('*')
                .eq('tournamentId', tournamentId)
                .in('walletAddress', tournament.winnerAddresses)
                .order('winningRank', { ascending: true });

            if (!winnersError && winnerParticipants) {
                winners = winnerParticipants;
            }
        }

        // Get game results
        const { data: gameResults, error: gameResultsError } = await supabaseAdmin
            .from('GameResults')
            .select('*')
            .eq('tournamentId', tournamentId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        return NextResponse.json({
            tournament,
            winners,
            gameResults: gameResults || null
        });
    } catch (error) {
        console.error('Error fetching tournament results:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tournament results' },
            { status: 500 }
        );
    }
}