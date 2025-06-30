import { getContract } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "@/lib/config/chains";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";

// Base Sepolia contract address as fallback
const FALLBACK_CONTRACT_ADDRESS = "0xE5e646aF90F8F1F1B72AcB1F7d3AcE43D91F5a34";

export function useContract() {
  const { user, authenticated } = usePrivy();

  if (!authenticated || !user?.wallet) {
    console.log("useContract: User not authenticated or no wallet available");
    return null;
  }

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || FALLBACK_CONTRACT_ADDRESS;

  console.log("useContract: Creating contract with address", contractAddress);
  console.log("useContract: Chain", baseSepolia.name, baseSepolia.id);

  try {
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
}
