-- Create approved_tokens table for caching token approval status
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

-- Insert default ETH token
INSERT INTO approved_tokens (address, name, symbol, decimals, total_supply, is_native, is_approved)
VALUES (
    '0x0000000000000000000000000000000000000000',
    'Ethereum',
    'ETH',
    18,
    '∞',
    TRUE,
    TRUE
) ON CONFLICT (address) DO NOTHING;

-- Insert known Base Sepolia tokens
INSERT INTO approved_tokens (address, name, symbol, decimals, total_supply, is_native, is_approved)
VALUES 
    (
        '0x036CbD53842c5426634e7929541eC2318f3dCF7c',
        'USD Coin',
        'USDC',
        6,
        '0',
        FALSE,
        FALSE
    ),
    (
        '0x4200000000000000000000000000000000000006',
        'Wrapped Ether',
        'WETH',
        18,
        '0',
        FALSE,
        FALSE
    ),
    (
        '0x0A8C4a30716Cecd8739fc43A73F2881e1309Af24',
        'Match Token',
        'MATCH',
        18,
        '0',
        FALSE,
        FALSE
    )
ON CONFLICT (address) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_approved_tokens_address ON approved_tokens(address);
CREATE INDEX IF NOT EXISTS idx_approved_tokens_approved ON approved_tokens(is_approved);

-- Add RLS policies (optional - for admin management)
ALTER TABLE approved_tokens ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
CREATE POLICY "Allow read access to approved tokens" ON approved_tokens
    FOR SELECT USING (true);

-- Only allow admins to update (you can customize this based on your auth setup)
CREATE POLICY "Allow admin update of approved tokens" ON approved_tokens
    FOR UPDATE USING (auth.role() = 'authenticated'); 