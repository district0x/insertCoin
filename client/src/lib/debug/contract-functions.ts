import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { ONEVONE_ABI } from '../contracts/abis/OneVOne';
import { ONEVONE_ADDRESS } from '../contracts/addresses';

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

export async function debugContractFunctions() {
    try {
        console.log('Checking contract functions...');

        // Try to read the owner
        const owner = await publicClient.readContract({
            address: ONEVONE_ADDRESS,
            abi: ONEVONE_ABI,
            functionName: 'owner',
        });
        console.log('Contract owner:', owner);

        // Check if your address is admin
        const isAdmin = await publicClient.readContract({
            address: ONEVONE_ADDRESS,
            abi: ONEVONE_ABI,
            functionName: 'isAdmin',
            args: ['0x840DD3a83e3230382C90F92819b235f98cB236AF'],
        });
        console.log('Is your address admin?', isAdmin);

        // Try to get the next match ID
        const nextMatchId = await publicClient.readContract({
            address: ONEVONE_ADDRESS,
            abi: ONEVONE_ABI,
            functionName: 'nextMatchId',
        });
        console.log('Next match ID:', nextMatchId);

    } catch (error) {
        console.error('Error debugging contract:', error);
    }
} 