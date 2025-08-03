import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from '@/lib/config/chains';
import { ONEVONE_ABI } from '@/lib/contracts/abis/ABI';
import { MATCH_TOKEN } from '@/lib/constants/tokens';

// GET /api/debug-contract-balance
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const matchId = searchParams.get('matchId');

        console.log(`[API] Debugging contract balance for match: ${matchId}`);

        // Create public client
        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
        });

        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        // Get contract's MATCH token balance
        const matchTokenBalance = await publicClient.readContract({
            address: MATCH_TOKEN.address as `0x${string}`,
            abi: [
                {
                    inputs: [{ internalType: "address", name: "account", type: "address" }],
                    name: "balanceOf",
                    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
                    stateMutability: "view",
                    type: "function",
                }
            ],
            functionName: "balanceOf",
            args: [contractAddress]
        });

        // Get contract's ETH balance
        const ethBalance = await publicClient.getBalance({ address: contractAddress });

        // Get match details if matchId is provided
        let matchDetails = null;
        if (matchId) {
            try {
                const match = await publicClient.readContract({
                    address: contractAddress,
                    abi: ONEVONE_ABI,
                    functionName: "matches",
                    args: [BigInt(matchId)]
                });

                matchDetails = {
                    player1: match[0],
                    player2: match[1],
                    player1Amount: match[2],
                    player2Amount: match[3],
                    totalAmount: match[4],
                    donatedAmount: match[5],
                    isOpen: match[6],
                    isClosed: match[7],
                    isERC20: match[8],
                    token: match[9]
                };
            } catch (error) {
                console.error(`[API] Error fetching match ${matchId}:`, error);
            }
        }

        // Calculate required payout
        let requiredPayout = 0n;
        if (matchDetails && matchDetails.isERC20) {
            const totalPrize = matchDetails.totalAmount + matchDetails.donatedAmount;
            requiredPayout = (totalPrize * 80n) / 100n; // 80% to winner
        }

        console.log(`[API] Contract balance analysis:`, {
            contractAddress,
            matchTokenBalance: matchTokenBalance.toString(),
            ethBalance: ethBalance.toString(),
            requiredPayout: requiredPayout.toString(),
            matchDetails
        });

        return NextResponse.json({
            success: true,
            contractAddress,
            balances: {
                matchTokens: matchTokenBalance.toString(),
                eth: ethBalance.toString()
            },
            matchDetails,
            requiredPayout: requiredPayout.toString(),
            hasEnoughTokens: matchTokenBalance >= requiredPayout,
            analysis: {
                isERC20Match: matchDetails?.isERC20 || false,
                totalPrize: matchDetails ? (matchDetails.totalAmount + matchDetails.donatedAmount).toString() : '0',
                winnerPayout: requiredPayout.toString(),
                shortfall: requiredPayout > matchTokenBalance ? (requiredPayout - matchTokenBalance).toString() : '0'
            }
        });

    } catch (error) {
        console.error('[API] Error debugging contract balance:', error);
        return NextResponse.json(
            {
                error: 'Failed to debug contract balance',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 