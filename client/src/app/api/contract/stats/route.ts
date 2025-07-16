import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { baseSepolia } from '@/lib/config/chains';

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
});

// MATCH Token contract address
const MATCH_TOKEN_ADDRESS = '0x0A8C4a30716Cecd8739fc43A73F2881e1309Af24';

// ERC-20 ABI for balanceOf function
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "type": "function"
    }
];

// Function to get ETH price from CoinGecko
async function getEthPrice(): Promise<number> {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        return data.ethereum.usd;
    } catch (error) {
        console.error('Error fetching ETH price:', error);
        return 3000; // Fallback price
    }
}

export async function GET(request: NextRequest) {
    try {
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

        if (!contractAddress) {
            throw new Error('Contract address not configured');
        }

        console.log('[CONTRACT-STATS] Fetching stats for contract:', contractAddress);
        console.log('[CONTRACT-STATS] MATCH token address:', MATCH_TOKEN_ADDRESS);

        // Get ETH balance of the contract
        const ethBalance = await publicClient.getBalance({
            address: contractAddress as `0x${string}`,
        });

        console.log('[CONTRACT-STATS] ETH balance (wei):', ethBalance.toString());

        // Get real-time ETH price in USD
        const ethPriceUSD = await getEthPrice();
        const ethBalanceUSD = (Number(ethBalance) / 1e18) * ethPriceUSD;

        console.log('[CONTRACT-STATS] ETH price USD:', ethPriceUSD);
        console.log('[CONTRACT-STATS] ETH balance USD:', ethBalanceUSD);

        // Get MATCH token balance of the contract
        let matchTokenBalance = "0";
        let matchTokenDecimals = 18;

        try {
            console.log('[CONTRACT-STATS] Fetching MATCH token decimals...');

            // Get token decimals
            const decimals = await publicClient.readContract({
                address: MATCH_TOKEN_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'decimals',
            });
            matchTokenDecimals = Number(decimals);

            console.log('[CONTRACT-STATS] MATCH token decimals:', matchTokenDecimals);

            console.log('[CONTRACT-STATS] Fetching MATCH token balance...');

            // Get token balance
            const balance = await publicClient.readContract({
                address: MATCH_TOKEN_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [contractAddress as `0x${string}`],
            }) as bigint;

            console.log('[CONTRACT-STATS] MATCH token balance (raw):', balance.toString());

            // Convert balance to decimal format
            matchTokenBalance = (Number(balance) / Math.pow(10, matchTokenDecimals)).toString();

            console.log('[CONTRACT-STATS] MATCH token balance (formatted):', matchTokenBalance);
        } catch (tokenError) {
            console.error('[CONTRACT-STATS] Error fetching MATCH token balance:', tokenError);
            // If token balance fails, we'll return 0 but not fail the entire request
            matchTokenBalance = "0";
        }

        const result = {
            ethBalance: (Number(ethBalance) / 1e18).toString(),
            ethBalanceUSD: ethBalanceUSD.toFixed(2),
            matchTokenBalance: matchTokenBalance,
        };

        console.log('[CONTRACT-STATS] Final result:', result);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[CONTRACT-STATS] Error fetching contract stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch contract statistics' },
            { status: 500 }
        );
    }
} 