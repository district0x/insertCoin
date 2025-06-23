import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { action, fromBlock, toBlock }: {
            action: string;
            fromBlock?: string | number;
            toBlock?: string | number;
        } = await request.json();

        if (action === 'process_historical') {
            // Process historical events
            const provider = new ethers.providers.JsonRpcProvider(
                process.env.NEXT_PUBLIC_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-api-key'
            );

            const contractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS;

            if (!contractAddress) {
                return NextResponse.json(
                    { error: 'Contract address not configured' },
                    { status: 400 }
                );
            }

            // Import TournamentABI dynamically to avoid build issues
            const { TournamentABI } = await import('@/lib/contracts/TournamentABI');
            const contract = new ethers.Contract(contractAddress, TournamentABI, provider);

            const processedEvents: Array<{
                type: string;
                tournamentId?: string;
                matchId?: string;
                transactionHash: string;
            }> = [];

            try {
                // Get TournamentEnded events
                const tournamentEndedFilter = contract.filters.TournamentEnded();
                const tournamentEvents = await contract.queryFilter(
                    tournamentEndedFilter,
                    fromBlock || 'latest',
                    toBlock || 'latest'
                );

                // Process tournament events
                for (const event of tournamentEvents) {
                    const { tournamentId, winners, winnersPercentages } = event.args!;

                    const { data: tournament, error: tournamentError } = await supabaseAdmin
                        .from('Tournament')
                        .select('*')
                        .eq('tournamentId', tournamentId.toString())
                        .single();

                    if (tournamentError) {
                        console.error('Error fetching tournament:', tournamentError);
                        continue;
                    }

                    if (tournament) {
                        // Update tournament status
                        await supabaseAdmin
                            .from('Tournament')
                            .update({
                                status: 'COMPLETED',
                                completed_at: new Date().toISOString()
                            })
                            .eq('tournamentId', tournamentId.toString());

                        // Record winner payments
                        const totalPrizePool = tournament.totalPrize;

                        for (let i = 0; i < winners.length; i++) {
                            const winnerAddress = winners[i];
                            const percentage = winnersPercentages[i];
                            const amount = (BigInt(totalPrizePool) * BigInt(percentage)) / BigInt(100);

                            await supabaseAdmin.from('winner_payments').insert({
                                tournament_id: tournamentId.toString(),
                                winner_address: winnerAddress,
                                amount: amount.toString(),
                                percentage: percentage,
                                token_symbol: 'ETH',
                                token_address: '0x0000000000000000000000000000000000000000',
                                is_erc20: false,
                                transaction_hash: event.transactionHash,
                                block_number: event.blockNumber,
                                timestamp: new Date().toISOString(),
                                game_type: 'tournament',
                                total_prize_pool: totalPrizePool,
                                participants: []
                            });

                            // Update participant status
                            await supabaseAdmin
                                .from('TournamentParticipant')
                                .update({
                                    is_winner: true,
                                    prize_amount: amount.toString()
                                })
                                .eq('tournamentid', tournamentId.toString())
                                .eq('walletaddress', winnerAddress);
                        }

                        processedEvents.push({
                            type: 'TournamentEnded',
                            tournamentId: tournamentId.toString(),
                            transactionHash: event.transactionHash
                        });
                    }
                }
            } catch (error) {
                console.error('Error processing tournament events:', error);
            }

            try {
                // Get MatchClosed events
                const matchClosedFilter = contract.filters.MatchClosed();
                const matchEvents = await contract.queryFilter(
                    matchClosedFilter,
                    fromBlock || 'latest',
                    toBlock || 'latest'
                );

                // Process match events
                for (const event of matchEvents) {
                    const { matchId, winner, winnerAmount } = event.args!;

                    const { data: match } = await supabase
                        .from('matches')
                        .select('*')
                        .eq('match_id', matchId.toString())
                        .single();

                    if (match) {
                        await supabase.from('winner_payments').insert({
                            match_id: matchId.toString(),
                            winner_address: winner,
                            amount: winnerAmount.toString(),
                            percentage: 100,
                            token_symbol: match.token_symbol || 'ETH',
                            token_address: match.token_address || '0x0000000000000000000000000000000000000000',
                            is_erc20: match.is_erc20 || false,
                            transaction_hash: event.transactionHash,
                            block_number: event.blockNumber,
                            timestamp: new Date().toISOString(),
                            game_type: 'match',
                            total_prize_pool: match.total_amount,
                            participants: match.participants || []
                        });

                        processedEvents.push({
                            type: 'MatchClosed',
                            matchId: matchId.toString(),
                            transactionHash: event.transactionHash
                        });
                    }
                }
            } catch (error) {
                console.error('Error processing match events:', error);
            }

            return NextResponse.json({
                success: true,
                processedEvents,
                count: processedEvents.length
            });
        }

        if (action === 'process_tournament') {
            // Process events for a specific tournament
            const { tournamentId } = await request.json();

            if (!tournamentId) {
                return NextResponse.json(
                    { error: 'Tournament ID is required' },
                    { status: 400 }
                );
            }

            const provider = new ethers.providers.JsonRpcProvider(
                process.env.NEXT_PUBLIC_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-api-key'
            );

            const contractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT_ADDRESS;

            if (!contractAddress) {
                return NextResponse.json(
                    { error: 'Contract address not configured' },
                    { status: 400 }
                );
            }

            // Import TournamentABI dynamically to avoid build issues
            const { TournamentABI } = await import('@/lib/contracts/TournamentABI');
            const contract = new ethers.Contract(contractAddress, TournamentABI, provider);

            try {
                // Get TournamentEnded events for this specific tournament
                const tournamentEndedFilter = contract.filters.TournamentEnded(tournamentId);
                const tournamentEvents = await contract.queryFilter(tournamentEndedFilter);

                if (tournamentEvents.length > 0) {
                    const event = tournamentEvents[0]; // Take the first event
                    const { winners, winnersPercentages } = event.args!;

                    // Update tournament status
                    await supabaseAdmin
                        .from('Tournament')
                        .update({
                            status: 'COMPLETED',
                            completed_at: new Date().toISOString()
                        })
                        .eq('tournamentId', tournamentId.toString());

                    return NextResponse.json({
                        success: true,
                        message: `Tournament ${tournamentId} status updated to COMPLETED`,
                        event: {
                            type: 'TournamentEnded',
                            tournamentId: tournamentId.toString(),
                            transactionHash: event.transactionHash,
                            winners: winners,
                            percentages: winnersPercentages
                        }
                    });
                } else {
                    return NextResponse.json({
                        success: false,
                        message: `No TournamentEnded event found for tournament ${tournamentId}`
                    });
                }
            } catch (error) {
                console.error('Error processing tournament events:', error);
                return NextResponse.json(
                    { error: 'Failed to process tournament events' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Blockchain events error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 