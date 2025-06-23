import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: tournamentId } = await params;
        const { walletAddress, txHash } = await request.json();

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Wallet address is required' },
                { status: 400 }
            );
        }

        // First get the tournament to check if it exists and isn't full
        const { data: tournament, error: tournamentError } = await supabaseAdmin
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
        const { data: existingParticipant, error: participantError } = await supabaseAdmin
            .from('TournamentParticipant')
            .select('id')
            .eq('tournamentid', tournamentId)
            .eq('walletaddress', walletAddress)
            .maybeSingle();

        if (existingParticipant) {
            return NextResponse.json(
                { message: 'You are already a participant in this tournament' },
                { status: 200 }
            );
        }

        // Add participant
        const { data: participant, error: insertError } = await supabaseAdmin
            .from('TournamentParticipant')
            .insert({
                tournamentid: parseInt(tournamentId),
                walletaddress: walletAddress,
                joinedat: new Date().toISOString(),
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
        const { data: updatedTournament, error: updateError } = await supabaseAdmin
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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: tournamentId } = await params;

        const { data, error } = await supabaseAdmin
            .from('TournamentParticipant')
            .select('walletaddress, joinedat, iswinner, winningrank')
            .eq('tournamentid', tournamentId)
            .order('joinedat', { ascending: true });

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