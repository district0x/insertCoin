import { getContract } from "viem";
import { usePublicClient } from "wagmi";
import { ONEVONE_ABI } from "@/lib/contracts/abis/OneVOne";

// Base Sepolia contract address as fallback
const FALLBACK_CONTRACT_ADDRESS = "0xE5e646aF90F8F1F1B72AcB1F7d3AcE43D91F5a34";

export function useContract() {
  const publicClient = usePublicClient();

  if (!publicClient) {
    console.log("useContract: publicClient not available");
    return null;
  }

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || FALLBACK_CONTRACT_ADDRESS;
  
  console.log("useContract: Creating contract with address", contractAddress);
  console.log("useContract: Chain", publicClient.chain?.name, publicClient.chain?.id);
  
  // Verify we're on Base Sepolia (chain ID 84532)
  if (publicClient.chain?.id !== 84532) {
    console.warn("useContract: Warning - Not connected to Base Sepolia network!");
    console.warn("useContract: Connected to:", publicClient.chain?.name, publicClient.chain?.id);
  }

  try {
    if (!contractAddress) {
      throw new Error("Contract address is not defined");
    }
    
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
    console.error("useContract: Chain:", publicClient.chain?.name, publicClient.chain?.id);
    return null;
  }
}
