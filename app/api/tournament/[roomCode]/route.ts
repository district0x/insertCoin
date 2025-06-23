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
    { params }: { params: Promise<{ roomCode: string }> }
) {
    try {
        const { roomCode } = await params;

        if (!roomCode) {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }

        // Get tournament details by room code and join with token info
        const { data: tournament, error } = await supabaseAdmin
            .from('Tournament')
            .select(`
                *,
                approved_tokens (
                    address,
                    symbol,
                    decimals,
                    is_native
                )
            `)
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

        // Extract token info
        const tokenInfo = Array.isArray(tournament.approved_tokens)
            ? tournament.approved_tokens[0]
            : tournament.approved_tokens;

        const tokenSymbol = tokenInfo?.symbol || 'ETH';
        const tokenDecimals = tokenInfo?.decimals || 18;

        // Get current participant count from the TournamentParticipant table
        const { count: currentParticipants, error: countError } = await supabaseAdmin
            .from('TournamentParticipant')
            .select('*', { count: 'exact', head: true })
            .eq('tournamentid', tournament.tournamentId);

        if (countError) {
            console.error('Error getting participant count:', countError);
        }

        return NextResponse.json({
            isTournament: true,
            details: {
                tournamentId: tournament.tournamentId.toString(),
                roomCode: tournament.roomCode,
                entryFee: tournament.entryFee.toString(), // Raw value for tx
                entryFeeFormatted: ethers.utils.formatUnits(tournament.entryFee.toString(), tokenDecimals), // Formatted for display
                status: tournament.status,
                maxParticipants: tournament.maxParticipants,
                currentParticipants: currentParticipants || 0,
                totalPrize: tournament.totalPrize.toString(), // Raw value
                tokenAddress: tokenInfo?.address || '0x0000000000000000000000000000000000000000',
                tokenSymbol: tokenSymbol,
                tokenDecimals: tokenDecimals,
                createdAt: tournament.createdAt,
                updatedAt: tournament.updatedAt,
                isFull: (currentParticipants || 0) >= tournament.maxParticipants,
            }
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
    { params }: { params: Promise<{ roomCode: string }> }
) {
    try {
        const { roomCode } = await params;
        const data = await request.json();

        console.log('[DEBUG] RoomCode API POST called with:', { roomCode, data });

        if (!roomCode) {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }

        // Get tournament by room code
        console.log('[DEBUG] Looking up tournament by room code:', roomCode);
        const { data: tournament, error: tournamentError } = await supabaseAdmin
            .from('Tournament')
            .select('*')
            .eq('roomCode', roomCode)
            .single();

        console.log('[DEBUG] Tournament lookup result:', { tournament, error: tournamentError });

        if (tournamentError) {
            console.error('Supabase error:', tournamentError);
            return NextResponse.json(
                { error: `Tournament not found: ${tournamentError.message}` },
                { status: 404 }
            );
        }

        const tournamentId = tournament.tournamentId;
        console.log('[DEBUG] Found tournament with ID:', tournamentId);

        // Handle join tournament action
        if (data.action === 'join' && data.walletAddress) {
            console.log('[DEBUG] Processing join action for tournament:', tournamentId);

            // Validate required fields for joining
            if (!data.name || data.name.trim() === '') {
                return NextResponse.json(
                    { error: 'Player name is required to join a tournament' },
                    { status: 400 }
                );
            }

            // Validate name length and format
            const trimmedName = data.name.trim();
            if (trimmedName.length < 2 || trimmedName.length > 50) {
                return NextResponse.json(
                    { error: 'Player name must be between 2 and 50 characters' },
                    { status: 400 }
                );
            }

            // Get current participant count
            const { count: currentParticipants, error: countError } = await supabaseAdmin
                .from('TournamentParticipant')
                .select('*', { count: 'exact', head: true })
                .eq('tournamentid', tournamentId);

            if (countError) {
                console.error('Error getting participant count:', countError);
                // Continue anyway with a fallback value
            }

            console.log('[DEBUG] Current participants:', currentParticipants, 'Max participants:', tournament.maxParticipants);

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
                .eq('tournamentid', tournamentId)
                .eq('walletaddress', data.walletAddress)
                .single();

            console.log('[DEBUG] Existing participant check:', { existingParticipant, error: participantError });

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
                console.log('[DEBUG] Inserting participant with ID:', participantId);

                const { error: insertError } = await supabaseAdmin
                    .from('TournamentParticipant')
                    .insert([
                        {
                            id: participantId,
                            tournamentid: tournamentId,
                            walletaddress: data.walletAddress,
                            name: trimmedName, // Use the validated and trimmed name
                            joinedat: now
                        }
                    ]);

                if (insertError) {
                    console.error('Error inserting participant:', insertError);
                    return NextResponse.json(
                        { error: `Failed to add participant: ${insertError.message}` },
                        { status: 500 }
                    );
                }

                console.log('[DEBUG] Participant inserted successfully');
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