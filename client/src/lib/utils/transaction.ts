/**
 * Type-safe wrapper to convert viem transaction requests to Privy-compatible format
 * This ensures proper type conversion and handles readonly properties
 */
export function convertToPrivyRequest(request: Record<string, unknown>): Record<string, unknown> {
    // Convert the transaction request to be compatible with Privy's sendTransaction
    const convertedRequest = {
        ...request,
        // Convert type from string to number if needed
        type: request.type === 'legacy' ? 0 :
            request.type === 'eip1559' ? 2 :
                request.type === 'eip2930' ? 1 :
                    request.type,
        // Convert readonly accessList to mutable format
        accessList: request.accessList ?
            (request.accessList as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
                address: item.address,
                storageKeys: Array.isArray(item.storageKeys) ? [...(item.storageKeys as unknown[])] : item.storageKeys
            })) : undefined,
        // Ensure all other properties are properly typed
        to: request.to || request.address,
        value: request.value,
        nonce: request.nonce,
        gas: request.gas,
        gasPrice: request.gasPrice,
        maxFeePerGas: request.maxFeePerGas,
        maxPriorityFeePerGas: request.maxPriorityFeePerGas,
        data: request.data,
    };

    return convertedRequest;
}

/**
 * Type-safe wrapper for contract simulation and transaction sending
 * This ensures we follow best practices: simulate first, then send
 */
export async function simulateAndSendTransaction(
    simulationFn: () => Promise<Record<string, unknown>>,
    sendTransactionFn: (request: Record<string, unknown>) => Promise<unknown>
): Promise<string> {
    try {
        // Step 1: Simulate the transaction (best practice)
        console.log('Simulating transaction...');
        const simulationResult = await simulationFn();
        const request = simulationResult.request as Record<string, unknown>;

        // Step 2: Convert to Privy-compatible format
        const privyRequest = convertToPrivyRequest(request);

        // Step 3: Send the transaction
        console.log('Sending transaction...');
        const result = await sendTransactionFn(privyRequest);

        // Step 4: Extract hash
        const hash = typeof result === 'string' ? result : (result as Record<string, unknown>).hash as string;

        if (!hash) {
            throw new Error('Transaction failed: No hash returned');
        }

        console.log('Transaction sent successfully:', hash);
        return hash;

    } catch (error) {
        console.error('Transaction simulation or sending failed:', error);
        throw error;
    }
} 