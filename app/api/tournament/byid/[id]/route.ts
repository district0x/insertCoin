import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const tournamentId = params.id;

        // Query your Supabase table to find tournament info by ID
        const { data, error } = await supabase
            .from('Tournament')
            .select(`
        id,
        tournamentId,
        entryFee,
        status,
        maxParticipants,
        currentParticipants,
        totalPrize,
        tokenAddress,
        createdAt,
        updatedAt,
        roomCode,
        winnerAddresses
      `)
            .eq('tournamentId', tournamentId)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: 'Tournament not found' },
                { status: 404 }
            );
        }

        // Return the tournament information
        return NextResponse.json({
            tournament: {
                id: data.id,
                tournamentId: data.tournamentId.toString(),
                entryFee: data.entryFee.toString(),
                status: data.status,
                maxParticipants: data.maxParticipants,
                currentParticipants: data.currentParticipants || 0,
                totalPrize: data.totalPrize,
                tokenAddress: data.tokenAddress,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                roomCode: data.roomCode,
                winnerAddresses: data.winnerAddresses || [],
                isFull: (data.currentParticipants || 0) >= data.maxParticipants
            }
        });
    } catch (error) {
        console.error('Error fetching tournament info:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tournament info' },
            { status: 500 }
        );
    }
}

// Update tournament status
export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const tournamentId = params.id;
        const { status, winnerAddresses } = await request.json();

        // Construct update object
        const updateData: any = {
            updatedAt: new Date().toISOString()
        };

        // Add status if provided
        if (status) {
            updateData.status = status;
        }

        // Add winnerAddresses if provided
        if (winnerAddresses && Array.isArray(winnerAddresses)) {
            updateData.winnerAddresses = winnerAddresses;
        }

        // Update tournament
        const { data, error } = await supabase
            .from('Tournament')
            .update(updateData)
            .eq('tournamentId', tournamentId)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: 'Failed to update tournament' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            tournament: data
        });
    } catch (error) {
        console.error('Error updating tournament:', error);
        return NextResponse.json(
            { error: 'Failed to update tournament' },
            { status: 500 }
        );
    }
}