import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const tournamentId = params.id;
        const { walletAddress, txHash } = await request.json();

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Wallet address is required' },
                { status: 400 }
            );
        }

        // First get the tournament to check if it exists and isn't full
        const { data: tournament, error: tournamentError } = await supabase
            .from('Tournament')
            .select('currentParticipants, maxParticipants, status')
            .eq('tournamentId', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json(
                { error: 'Tournament not found' },
                { status: 404 }
            );
        }

        // Check if tournament is full
        if (tournament.currentParticipants >= tournament.maxParticipants) {
            return NextResponse.json(
                { error: 'Tournament is already full' },
                { status: 400 }
            );
        }

        // Check if participant already exists
        const { data: existingParticipant, error: participantError } = await supabase
            .from('TournamentParticipant')
            .select('id')
            .eq('tournamentId', tournamentId)
            .eq('walletAddress', walletAddress)
            .maybeSingle();

        if (existingParticipant) {
            return NextResponse.json(
                { message: 'You are already a participant in this tournament' },
                { status: 200 }
            );
        }

        // Add participant
        const { data: participant, error: insertError } = await supabase
            .from('TournamentParticipant')
            .insert({
                tournamentId: parseInt(tournamentId),
                walletAddress,
                joinedAt: new Date().toISOString(),
                txHash
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error adding participant:', insertError);
            return NextResponse.json(
                { error: 'Failed to add participant' },
                { status: 500 }
            );
        }

        // Update tournament participant count
        const { data: updatedTournament, error: updateError } = await supabase
            .from('Tournament')
            .update({
                currentParticipants: (tournament.currentParticipants || 0) + 1,
                updatedAt: new Date().toISOString(),
                // If this is the last spot, update status to ACTIVE
                status: (tournament.currentParticipants || 0) + 1 >= tournament.maxParticipants ? 'ACTIVE' : 'FILLING'
            })
            .eq('tournamentId', tournamentId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating tournament:', updateError);
            return NextResponse.json(
                { error: 'Failed to update tournament, but participant was added' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            participant,
            tournament: updatedTournament
        });
    } catch (error) {
        console.error('Error adding participant:', error);
        return NextResponse.json(
            { error: 'Failed to add participant' },
            { status: 500 }
        );
    }
}

// Get all participants for a tournament
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const tournamentId = params.id;

        const { data, error } = await supabase
            .from('TournamentParticipant')
            .select('walletAddress, joinedAt, isWinner, winningRank')
            .eq('tournamentId', tournamentId)
            .order('joinedAt', { ascending: true });

        if (error) {
            console.error('Error fetching participants:', error);
            return NextResponse.json(
                { error: 'Failed to fetch participants' },
                { status: 500 }
            );
        }

        return NextResponse.json({ participants: data });
    } catch (error) {
        console.error('Error fetching participants:', error);
        return NextResponse.json(
            { error: 'Failed to fetch participants' },
            { status: 500 }
        );
    }
}