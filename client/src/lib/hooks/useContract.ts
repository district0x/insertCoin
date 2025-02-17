import { getContract } from "viem";
import { usePublicClient } from "wagmi";
import { ONEVONE_ABI } from "@/lib/contracts/abis/OneVOne";

export function useContract() {
  const publicClient = usePublicClient();

  if (!publicClient) return null;

  return getContract({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    abi: ONEVONE_ABI,
    client: publicClient,
  });
}
