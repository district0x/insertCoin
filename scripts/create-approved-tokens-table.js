const { supabaseAdmin } = require('../lib/supabaseAdmin');

async function createApprovedTokensTable() {
    console.log('Setting up approved_tokens data...');

    try {
        // First, let's try to insert the default tokens
        const defaultTokens = [
            {
                address: '0x0000000000000000000000000000000000000000',
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
                total_supply: '∞',
                is_native: true,
                is_approved: true
            },
            {
                address: '0x036CbD53842c5426634e7929541eC2318f3dCF7c',
                name: 'USD Coin',
                symbol: 'USDC',
                decimals: 6,
                total_supply: '0',
                is_native: false,
                is_approved: false
            },
            {
                address: '0x4200000000000000000000000000000000000006',
                name: 'Wrapped Ether',
                symbol: 'WETH',
                decimals: 18,
                total_supply: '0',
                is_native: false,
                is_approved: false
            },
            {
                address: '0x0A8C4a30716Cecd8739fc43A73F2881e1309Af24',
                name: 'Match Token',
                symbol: 'MATCH',
                decimals: 18,
                total_supply: '0',
                is_native: false,
                is_approved: false
            }
        ];

        // Try to insert each token
        for (const token of defaultTokens) {
            try {
                const { error } = await supabaseAdmin
                    .from('approved_tokens')
                    .upsert(token, { onConflict: 'address' });

                if (error) {
                    console.log(`⚠️  Could not insert ${token.symbol}: ${error.message}`);
                } else {
                    console.log(`✅ Added ${token.symbol} token`);
                }
            } catch (err) {
                console.log(`⚠️  Error with ${token.symbol}: ${err.message}`);
            }
        }

        // Test the table by fetching data
        console.log('\nTesting table access...');
        const { data: tokens, error: fetchError } = await supabaseAdmin
            .from('approved_tokens')
            .select('*');

        if (fetchError) {
            console.error('❌ Error fetching tokens:', fetchError);
            console.log('\nThe table might not exist yet. You may need to create it manually in the Supabase dashboard.');
            console.log('SQL to run in Supabase SQL Editor:');
            console.log(`
CREATE TABLE IF NOT EXISTS approved_tokens (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    total_supply VARCHAR(255),
    is_native BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
            `);
        } else {
            console.log('✅ Table test successful! Found', tokens.length, 'tokens:');
            tokens.forEach(token => {
                console.log(`  - ${token.symbol} (${token.address}) - ${token.is_approved ? 'Approved' : 'Not Approved'}`);
            });
        }

    } catch (error) {
        console.error('Script error:', error);
    }
}

// Run the script
createApprovedTokensTable()
    .then(() => {
        console.log('\nScript completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    }); 