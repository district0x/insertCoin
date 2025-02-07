import { GetContractReturnType, PublicClient, WalletClient } from "viem";
import { ONEVONE_ABI } from "../contracts/abis/OneVOne";

export async function joinMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  matchId: bigint,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "joinMatch",
    args: [matchId],
    value: amount,
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}

export async function join2v2Team(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  matchId: bigint,
  isTeamA: boolean,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "join2v2Team",
    args: [matchId, isTeamA],
    value: amount,
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}

export async function join5v5Team(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  matchId: bigint,
  isTeamA: boolean,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  // Get current match state to determine the next available position
  const match5v5 = await publicClient.readContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "matches5v5",
    args: [matchId],
  });
  if (!match5v5) {
    throw new Error("Match not found");
  }

  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "join5v5Team",
    args: [matchId, isTeamA],
    value: amount,
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}

export async function donateToMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  matchId: bigint,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "donateToMatch",
    args: [matchId, amount],
    value: amount,
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}

export async function closeMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  walletClient: WalletClient,
  matchId: bigint,
  winner: `0x${string}`
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "closeMatch",
    args: [matchId, winner],
    account: walletClient.account.address,
  });

  return walletClient.writeContract(request);
}
