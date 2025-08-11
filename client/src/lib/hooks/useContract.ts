import { getContract } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";
import { useMemo } from "react";

// Base Sepolia contract address as fallback
const FALLBACK_CONTRACT_ADDRESS = "0xC24Cea38b8D6e7303DFfA7d5bc309FE5f8FCaD08";

// Environment variable validation
const validateEnvironmentVariables = () => {
  const missingVars = [];

  if (!process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) {
    missingVars.push('NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL');
  }

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

export function useContract() {
  const { user, authenticated } = usePrivy();

  return useMemo(() => {
    if (!authenticated || !user?.wallet) {
      console.log("useContract: User not authenticated or no wallet available");
      return null;
    }

    let contractAddress: string | undefined;

    try {
      // Validate environment variables
      validateEnvironmentVariables();

      contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || FALLBACK_CONTRACT_ADDRESS;

      console.log("useContract: Creating contract with address", contractAddress);
      console.log("useContract: Chain", baseSepolia.name, baseSepolia.id);

      if (!contractAddress) {
        throw new Error("Contract address is not defined");
      }

      // Create a public client using the RPC URL
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
      });

      const contract = getContract({
        address: contractAddress as `0x${string}`,
        abi: ONEVONE_ABI,
        client: publicClient,
      });

      console.log("useContract: Contract created successfully");
      return contract;
    } catch (error) {
      console.error("useContract: Error creating contract:", error);
      console.error("useContract: Contract Address:", contractAddress);
      console.error("useContract: Chain:", baseSepolia.name, baseSepolia.id);
      return null;
    }
  }, [authenticated, user?.wallet]);
}
