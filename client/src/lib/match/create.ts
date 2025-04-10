import { GetContractReturnType, PublicClient, WalletClient } from "viem";
import { ONEVONE_ABI } from "../contracts/abis/ABI";

export async function createMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "startMatch",
    args: [amount, "0x0000000000000000000000000000000000000000"],
    value: amount,
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}

export async function create2v2Match(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "start2v2Match",
    args: [amount, "0x0000000000000000000000000000000000000000"],
    value: amount,
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}

export async function create5v5Match(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  // For 5v5 matches, we need to ensure the amount is sufficient for 5 players
  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "start5v5Match",
    args: [amount, "0x0000000000000000000000000000000000000000"],
    value: amount, // This is the amount per player
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}
