import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        // Fetch winner payments without foreign key relationship
        const { data: payments, error } = await supabaseAdmin
            .from('winner_payments')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch winner payments' },
                { status: 500 }
            );
        }

        // Format the payments data
        const formattedPayments = payments?.map(payment => ({
            id: payment.id,
            tournamentId: payment.tournament_id,
            matchId: payment.match_id,
            winnerAddress: payment.winner_address,
            winnerName: payment.winner_name,
            amount: payment.amount,
            percentage: payment.percentage,
            tokenSymbol: payment.token_symbol,
            tokenAddress: payment.token_address,
            isErc20: payment.is_erc20,
            transactionHash: payment.transaction_hash,
            blockNumber: payment.block_number,
            timestamp: payment.timestamp,
            gameType: payment.game_type,
            totalPrizePool: payment.total_prize_pool,
            participants: payment.participants
        }));

        return NextResponse.json({
            payments: formattedPayments || [],
            count: formattedPayments?.length || 0
        });

    } catch (error) {
        console.error('Error fetching winner payments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch winner payments' },
            { status: 500 }
        );
    }
} 