import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: Fetch all tokens (approved and non-approved)
export async function GET(request: NextRequest) {
    try {
        const { data: tokens, error } = await supabaseAdmin
            .from('approved_tokens')
            .select('*')
            .order('is_native', { ascending: false })
            .order('symbol', { ascending: true });

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch tokens' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            tokens: tokens || [],
            success: true
        });

    } catch (error) {
        console.error('Error fetching tokens:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST: Add a new token
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, name, symbol, decimals, totalSupply, isNative } = body;

        // Validate required fields
        if (!address || !name || !symbol) {
            return NextResponse.json(
                { error: 'Address, name, and symbol are required' },
                { status: 400 }
            );
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return NextResponse.json(
                { error: 'Invalid Ethereum address format' },
                { status: 400 }
            );
        }

        // Check if token already exists
        const { data: existingToken } = await supabaseAdmin
            .from('approved_tokens')
            .select('id')
            .eq('address', address)
            .single();

        if (existingToken) {
            return NextResponse.json(
                { error: 'Token with this address already exists' },
                { status: 409 }
            );
        }

        // Insert new token
        const { data: newToken, error } = await supabaseAdmin
            .from('approved_tokens')
            .insert({
                address,
                name,
                symbol,
                decimals: decimals || 18,
                total_supply: totalSupply || '0',
                is_native: isNative || false,
                is_approved: false // Default to not approved
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: 'Failed to add token' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            token: newToken,
            success: true,
            message: 'Token added successfully'
        });

    } catch (error) {
        console.error('Error adding token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PUT: Update token approval status
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, isApproved } = body;

        if (!address || typeof isApproved !== 'boolean') {
            return NextResponse.json(
                { error: 'Address and isApproved are required' },
                { status: 400 }
            );
        }

        // Update token approval status
        const { data: updatedToken, error } = await supabaseAdmin
            .from('approved_tokens')
            .update({
                is_approved: isApproved,
                updated_at: new Date().toISOString()
            })
            .eq('address', address)
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: 'Failed to update token' },
                { status: 500 }
            );
        }

        if (!updatedToken) {
            return NextResponse.json(
                { error: 'Token not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            token: updatedToken,
            success: true,
            message: `Token ${isApproved ? 'approved' : 'unapproved'} successfully`
        });

    } catch (error) {
        console.error('Error updating token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE: Remove a token
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json(
                { error: 'Address parameter is required' },
                { status: 400 }
            );
        }

        // Don't allow deletion of native ETH
        if (address === '0x0000000000000000000000000000000000000000') {
            return NextResponse.json(
                { error: 'Cannot delete native ETH token' },
                { status: 400 }
            );
        }

        // Delete token
        const { error } = await supabaseAdmin
            .from('approved_tokens')
            .delete()
            .eq('address', address);

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: 'Failed to delete token' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Token deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 