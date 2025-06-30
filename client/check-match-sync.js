const { PrismaClient } = require('@prisma/client');
const { createPublicClient, http } = require('viem');

const prisma = new PrismaClient();

// Create public client
const publicClient = createPublicClient({
    chain: { id: 84532, name: 'Base Sepolia' },
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
});

async function checkMatchSync() {
    try {
        console.log('🔍 Checking match ID synchronization...\n');

        // Get contract nextMatchId
        console.log('📋 Reading smart contract nextMatchId...');
        const contractNextMatchId = await publicClient.readContract({
            address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
            abi: [
                {
                    inputs: [],
                    name: "nextMatchId",
                    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
                    stateMutability: "view",
                    type: "function",
                }
            ],
            functionName: "nextMatchId",
        });

        console.log(`✅ Contract nextMatchId: ${contractNextMatchId}`);

        // Get database nextMatchId
        console.log('\n📋 Reading database nextMatchId...');
        const lastMatch = await prisma.match.findFirst({
            orderBy: { matchId: "desc" },
        });

        const dbNextMatchId = (lastMatch?.matchId ?? 0) + 1;
        console.log(`✅ Database nextMatchId: ${dbNextMatchId}`);

        // Compare
        console.log('\n📊 Comparison:');
        console.log(`   Contract: ${contractNextMatchId}`);
        console.log(`   Database: ${dbNextMatchId}`);

        if (contractNextMatchId === dbNextMatchId) {
            console.log('\n✅ Database and contract are in sync!');
        } else if (contractNextMatchId > dbNextMatchId) {
            console.log(`\n⚠️  Contract is ahead by ${contractNextMatchId - dbNextMatchId} matches`);
            console.log('   This means there are matches on-chain that are not in the database.');
        } else {
            console.log(`\n⚠️  Database is ahead by ${dbNextMatchId - contractNextMatchId} matches`);
            console.log('   This means there are database matches that are not on-chain.');
        }

        // Show recent matches
        console.log('\n📋 Recent database matches:');
        const recentMatches = await prisma.match.findMany({
            orderBy: { matchId: "desc" },
            take: 5,
            select: {
                matchId: true,
                status: true,
                matchType: true,
                stake: true,
                creatorDiscordId: true,
            }
        });

        recentMatches.forEach(match => {
            console.log(`   Match ${match.matchId}: ${match.status} ${match.matchType} (${match.stake} ETH) - Discord: ${match.creatorDiscordId || 'None'}`);
        });

        // Recommendations
        console.log('\n💡 Recommendations:');
        if (contractNextMatchId !== dbNextMatchId) {
            console.log('   1. Deploy a new smart contract to start fresh');
            console.log('   2. Or use the syncMatchIdWithContract function to align them');
            console.log('   3. Clear the database and start over');
        } else {
            console.log('   1. You can continue using the current setup');
            console.log('   2. The prepared statement error is likely a connection pooling issue');
        }

    } catch (error) {
        console.error('❌ Error checking match sync:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMatchSync(); 