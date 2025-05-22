import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const tournamentId = params.id;
        const {
            winners,
            txHash
        } = await request.json();

        // Validate required fields
        if (!tournamentId || !Array.isArray(winners) || winners.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields or invalid winners format' },
                { status: 400 }
            );
        }

        // Extract wallet addresses from winners array
        const winnerAddresses = winners.map(w => w.address);

        // Update tournament record in Supabase
        const { data, error } = await supabase
            .from('Tournament')
            .update({
                status: 'COMPLETED',
                winnerAddresses,
                updatedAt: new Date().toISOString()
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
                await supabase
                    .from('TournamentParticipant')
                    .update({
                        isWinner: true,
                        winningRank: i + 1
                    })
                    .eq('tournamentId', tournamentId)
                    .eq('walletAddress', winner.address);
            } catch (err) {
                console.warn(`Warning: Failed to update participant status for ${winner.address}`, err);
                // Continue with other winners even if one update fails
            }
        }

        // Insert results into game history/leaderboard
        try {
            await supabase
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
    { params }: { params: { id: string } }
) {
    try {
        const tournamentId = params.id;

        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
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
            const { data: winnerParticipants, error: winnersError } = await supabase
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
        const { data: gameResults, error: gameResultsError } = await supabase
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