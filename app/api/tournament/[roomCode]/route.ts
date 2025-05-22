// app/api/tournament/[roomCode]/route.ts - UUID-specific version
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ethers } from 'ethers';

// Generate a UUID compatible with Supabase
function generateUUID() {
    // Use the built-in crypto.randomUUID() if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback to a simple implementation if crypto.randomUUID is not available
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: { roomCode: string } }
) {
    try {
        const roomCode = params.roomCode;

        if (!roomCode) {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }

        // Get tournament details by room code
        const { data: tournament, error } = await supabaseAdmin
            .from('Tournament')
            .select('*')
            .eq('roomCode', roomCode)
            .single();

        if (error) {
            // If no tournament found, return standard response for non-tournament rooms
            if (error.code === 'PGRST116') {
                return NextResponse.json({
                    isTournament: false
                });
            }

            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: `Database error: ${error.message}` },
                { status: 500 }
            );
        }

        // Get current participant count from the TournamentParticipant table
        const { count: currentParticipants, error: countError } = await supabaseAdmin
            .from('TournamentParticipant')
            .select('*', { count: 'exact', head: true })
            .eq('tournamentId', tournament.tournamentId);

        if (countError) {
            console.error('Error getting participant count:', countError);
        }

        // Try to format entry fee to ETH if it's in wei format
        let entryFeeFormatted = tournament.entryFee;
        try {
            // If the entry fee is a large number (wei), format it to ETH
            if (tournament.entryFee && tournament.entryFee.toString().length > 10) {
                entryFeeFormatted = ethers.utils.formatEther(tournament.entryFee);
            }
        } catch (err) {
            console.error("Error formatting entry fee:", err);
            // If formatting fails, just use the original value
        }

        return NextResponse.json({
            isTournament: true,
            id: tournament.id,
            tournamentId: tournament.tournamentId.toString(),
            entryFee: entryFeeFormatted,
            entryFeeWei: tournament.entryFee.toString(), // Include the raw wei value for contract interactions
            status: tournament.status,
            maxParticipants: tournament.maxParticipants,
            currentParticipants: currentParticipants || 0, // Calculated dynamically
            totalPrize: tournament.totalPrize,
            tokenAddress: tournament.tokenAddress,
            createdAt: tournament.createdAt,
            updatedAt: tournament.updatedAt,
            isFull: (currentParticipants || 0) >= tournament.maxParticipants
        });
    } catch (error: any) {
        console.error('Server error:', error);
        return NextResponse.json(
            { error: `Server error: ${error.message}` },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { roomCode: string } }
) {
    try {
        const roomCode = params.roomCode;
        const data = await request.json();

        if (!roomCode) {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }

        // Get tournament by room code
        const { data: tournament, error: tournamentError } = await supabaseAdmin
            .from('Tournament')
            .select('*')
            .eq('roomCode', roomCode)
            .single();

        if (tournamentError) {
            console.error('Supabase error:', tournamentError);
            return NextResponse.json(
                { error: `Tournament not found: ${tournamentError.message}` },
                { status: 404 }
            );
        }

        const tournamentId = tournament.tournamentId;

        // Handle join tournament action
        if (data.action === 'join' && data.walletAddress) {
            // Get current participant count
            const { count: currentParticipants, error: countError } = await supabaseAdmin
                .from('TournamentParticipant')
                .select('*', { count: 'exact', head: true })
                .eq('tournamentId', tournamentId);

            if (countError) {
                console.error('Error getting participant count:', countError);
                // Continue anyway with a fallback value
            }

            // Check if tournament is full
            if ((currentParticipants || 0) >= tournament.maxParticipants) {
                return NextResponse.json(
                    { error: 'Tournament is already full' },
                    { status: 400 }
                );
            }

            // Check if participant already exists
            const { data: existingParticipant, error: participantError } = await supabaseAdmin
                .from('TournamentParticipant')
                .select('*')
                .eq('tournamentId', tournamentId)
                .eq('walletAddress', data.walletAddress)
                .single();

            if (!participantError && existingParticipant) {
                // Participant already exists, return success
                return NextResponse.json({
                    success: true,
                    message: 'Already joined this tournament',
                    tournamentId
                });
            }

            // Get current timestamp
            const now = new Date().toISOString();

            // Update tournament status if it will be full after this join
            if ((currentParticipants || 0) + 1 >= tournament.maxParticipants) {
                const { data: updatedTournament, error: updateError } = await supabaseAdmin
                    .from('Tournament')
                    .update({
                        status: 'ACTIVE',
                        updatedAt: now // Add the updatedAt timestamp
                    })
                    .eq('roomCode', roomCode)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Error updating tournament status:', updateError);
                    // Continue anyway as the participant data is more important
                }
            }

            // Add participant to tournament
            if (data.walletAddress) {
                // Generate a UUID for the participant record
                const participantId = generateUUID();

                const { error: participantInsertError } = await supabaseAdmin
                    .from('TournamentParticipant')
                    .insert([
                        {
                            id: participantId, // Include UUID for the id column
                            tournamentId: tournamentId,
                            walletAddress: data.walletAddress,
                            joinedAt: now // Use the same timestamp
                        }
                    ]);

                if (participantInsertError) {
                    console.warn('Warning: Failed to add participant record', participantInsertError);
                    return NextResponse.json(
                        { error: `Failed to add participant: ${participantInsertError.message}` },
                        { status: 500 }
                    );
                }
            }

            // Get the updated tournament
            const { data: updatedTournament, error: fetchError } = await supabaseAdmin
                .from('Tournament')
                .select('*')
                .eq('roomCode', roomCode)
                .single();

            return NextResponse.json({
                success: true,
                message: 'Successfully joined tournament',
                tournamentId,
                tournament: updatedTournament || tournament
            });
        }

        return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
        );
    } catch (error: any) {
        console.error('Server error:', error);
        return NextResponse.json(
            { error: `Server error: ${error.message}` },
            { status: 500 }
        );
    }
}