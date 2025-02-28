import { getContract } from "viem";
import { usePublicClient } from "wagmi";
import { ONEVONE_ABI } from "@/lib/contracts/abis/OneVOne";

export function useContract() {
  const publicClient = usePublicClient();

  if (!publicClient) {
    console.log("useContract: publicClient not available");
    return null;
  }

  console.log("useContract: Creating contract with address", process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
  console.log("useContract: Chain", publicClient.chain?.name, publicClient.chain?.id);

  try {
    const contract = getContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: ONEVONE_ABI,
      client: publicClient,
    });
    
    console.log("useContract: Contract created successfully");
    return contract;
  } catch (error) {
    console.error("useContract: Error creating contract:", error);
    return null;
  }
}
