import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ethers } from 'ethers';

// Helper to format amounts based on token data
const formatTokenAmount = (
    amount: string | number | null,
    token: { symbol?: string; decimals?: number } | null,
    isWinnerPayment: boolean = false
): string => {
    const symbol = token?.symbol || 'ETH';
    if (amount === null || amount === undefined) return isWinnerPayment ? `0 ${symbol}` : `0.00 ${symbol}`;

    const decimals = token?.decimals || 18;
    const amountStr = amount.toString();

    try {
        if (amountStr.includes('.') && !isWinnerPayment) {
            return `${parseFloat(amountStr).toFixed(4)} ${symbol}`;
        }
        const formattedValue = ethers.utils.formatUnits(amountStr, decimals);
        return `${parseFloat(parseFloat(formattedValue).toFixed(4))} ${symbol}`;
    } catch (error) {
        console.error('Error formatting token amount:', { amount, symbol, decimals }, error);
        return `0.00 ${symbol}`;
    }
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '5');

        // Step 1: Fetch recent tournaments and their token info
        const { data: tournaments, error: tournamentsError } = await supabaseAdmin
            .from('Tournament')
            .select(`
                *,
                approved_tokens (
                    symbol,
                    decimals,
                    is_native
                )
            `)
            .order('createdAt', { ascending: false })
            .limit(limit);

        if (tournamentsError) {
            console.error('Database error fetching tournaments:', tournamentsError);
            return NextResponse.json({ error: 'Failed to fetch recent games' }, { status: 500 });
        }

        // Step 2: Fetch participants and winners for each tournament
        const games = await Promise.all(
            (tournaments || []).map(async (tournament: any) => {
                // Fetch participants
                const { data: participants } = await supabaseAdmin
                    .from('TournamentParticipant')
                    .select('name, walletaddress, score, is_winner, prize_amount')
                    .eq('tournamentid', tournament.tournamentId);

                // Fetch winner payments
                const { data: winnerPayments } = await supabaseAdmin
                    .from('winner_payments')
                    .select('winner_address, winner_name, amount, percentage')
                    .eq('tournament_id', tournament.tournamentId);

                const tokenInfo = Array.isArray(tournament.approved_tokens)
                    ? tournament.approved_tokens[0]
                    : tournament.approved_tokens;

                // Shape the winners array
                const winners = (winnerPayments || []).map((payment: any) => ({
                    address: payment.winner_address,
                    name: payment.winner_name || 'Unknown',
                    amount: payment.amount,
                    amountFormatted: formatTokenAmount(payment.amount, tokenInfo, true),
                    percentage: payment.percentage,
                }));

                return {
                    tournamentId: tournament.tournamentId,
                    roomCode: tournament.roomCode,
                    status: tournament.status,
                    gameType: tournament.game_type || 'tournament',
                    completedAt: tournament.completed_at || tournament.createdAt,
                    totalPrizePool: tournament.totalPrize,
                    totalPrizePoolFormatted: formatTokenAmount(tournament.totalPrize, tokenInfo),
                    entryFee: tournament.entryFee,
                    entryFeeFormatted: formatTokenAmount(tournament.entryFee, tokenInfo),
                    participants: participants || [],
                    tokenSymbol: tokenInfo?.symbol || 'ETH',
                    isErc20: tokenInfo ? !tokenInfo.is_native : false,
                    winners: winners,
                    ...tournament,
                };
            })
        );

        return NextResponse.json({ games: games, count: games.length });
    } catch (error) {
        console.error('Error fetching recent games:', error);
        return NextResponse.json({ error: 'Failed to fetch recent games' }, { status: 500 });
    }
} 