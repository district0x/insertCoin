import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ethers } from 'ethers';

export const revalidate = 0;

export async function GET() {
    try {
        // Step 1: Find the most recent tournament and join with token info
        const { data: tournament, error: tournamentError } = await supabaseAdmin
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
            .order('createdAt', { ascending: false })
            .limit(1)
            .single();

        if (tournamentError || !tournament) {
            if (tournamentError && tournamentError.code !== 'PGRST116') { // no rows found
                console.error('Error fetching tournament:', tournamentError.message);
            }
            return NextResponse.json({ tournament: null });
        }

        // Step 2: Fetch participants
        const { data: participants, error: participantsError } = await supabaseAdmin
            .from('TournamentParticipant')
            .select('name, walletaddress, joinedat')
            .eq('tournamentid', tournament.tournamentId)
            .order('joinedat', { ascending: true });

        if (participantsError) {
            console.error('Error fetching participants:', participantsError.message);
            throw new Error('Could not fetch tournament participants.');
        }

        // Step 3: Extract token info and format data
        const tokenInfo = Array.isArray(tournament.approved_tokens)
            ? tournament.approved_tokens[0]
            : tournament.approved_tokens;

        const tokenSymbol = tokenInfo?.symbol || 'ETH';
        const tokenDecimals = tokenInfo?.decimals || 18;
        const playerCount = participants?.length || 0;

        // Use ethers to handle large numbers safely, now with robust parsing
        const entryFeeInWei = ethers.BigNumber.from(toBigNumberString(tournament.entryFee));
        const prizePoolInWei = entryFeeInWei.mul(playerCount);

        const getStatusDisplay = (status: string) => {
            switch (status) {
                case 'FILLING': return 'Joining';
                case 'ACTIVE': return 'In Progress';
                case 'COMPLETED': return 'Complete';
                case 'CANCELLED': return 'Cancelled';
                default: return status;
            }
        };

        const getStatusColor = (status: string) => {
            switch (status) {
                case 'FILLING': return 'yellow';
                case 'ACTIVE': return 'blue';
                case 'COMPLETED': return 'green';
                case 'CANCELLED': return 'red';
                default: return 'gray';
            }
        };

        // Step 4: Return the enhanced data
        const currentGameData = {
            tournamentId: tournament.tournamentId.toString(),
            roomCode: tournament.roomCode,
            status: tournament.status,
            statusDisplay: getStatusDisplay(tournament.status),
            statusColor: getStatusColor(tournament.status),
            playerCount: playerCount,
            maxParticipants: tournament.maxParticipants,
            participants: participants?.map((p: any) => ({ name: p.name, address: p.walletaddress, joinedAt: p.joinedat })) || [],
            // Send amounts in Wei and also formatted
            entryFee: tournament.entryFee,
            entryFeeFormatted: ethers.utils.formatUnits(entryFeeInWei, tokenDecimals),
            prizePool: prizePoolInWei.toString(),
            prizePoolFormatted: ethers.utils.formatUnits(prizePoolInWei, tokenDecimals),
            // Token Information
            tokenAddress: tokenInfo?.address || '0x0000000000000000000000000000000000000000',
            tokenSymbol: tokenSymbol,
            tokenDecimals: tokenDecimals,
            // Other fields
            createdAt: tournament.createdAt,
            updatedAt: tournament.updatedAt,
            isFull: playerCount >= tournament.maxParticipants
        };

        return NextResponse.json({ tournament: currentGameData });

    } catch (error) {
        console.error('Error in current-tournament API:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
}

/**
 * Safely converts a number or string (including scientific notation) to a
 * string representation of a whole number that ethers.BigNumber can parse.
 * @param num The number or string to convert.
 * @returns A string representation of the whole number.
 */
function toBigNumberString(num: string | number | null | undefined): string {
    if (num === null || num === undefined) {
        return '0';
    }
    const numStr = String(num);

    // If it's in scientific notation, parse it and convert to a full string.
    if (numStr.includes('e')) {
        // Using BigInt for precision with large numbers.
        try {
            return BigInt(parseFloat(numStr)).toString();
        } catch (e) {
            console.error(`Could not convert scientific notation "${numStr}" to BigInt`, e);
            return '0';
        }
    }
    return numStr;
} 