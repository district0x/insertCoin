import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
    try {
        // Fetch approved tokens from Supabase
        const { data: tokens, error } = await supabaseAdmin
            .from('approved_tokens')
            .select('*')
            .eq('is_approved', true)
            .order('is_native', { ascending: false }) // Native tokens first
            .order('symbol', { ascending: true });

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch approved tokens from database' },
                { status: 500 }
            );
        }

        // Transform the data to match the expected format
        const formattedTokens = tokens?.map((token: any) => ({
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            totalSupply: token.total_supply,
            isApproved: token.is_approved,
            isNative: token.is_native
        })) || [];

        // Always ensure ETH is available as fallback
        const hasEth = formattedTokens.some((token: any) => token.address === '0x0000000000000000000000000000000000000000');

        if (!hasEth) {
            formattedTokens.unshift({
                address: '0x0000000000000000000000000000000000000000',
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
                totalSupply: '∞',
                isApproved: true,
                isNative: true
            });
        }

        return NextResponse.json({
            tokens: formattedTokens,
            success: true,
            source: 'database'
        });

    } catch (error) {
        console.error('Error fetching approved tokens:', error);

        // Fallback to just ETH if everything fails
        return NextResponse.json({
            tokens: [{
                address: '0x0000000000000000000000000000000000000000',
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
                totalSupply: '∞',
                isApproved: true,
                isNative: true
            }],
            success: true,
            source: 'fallback',
            message: 'Using fallback data due to database error'
        });
    }
} 