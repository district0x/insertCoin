import { useContract } from "./useContract";
import { useWalletClient, usePublicClient } from "wagmi";
import { BaseError } from "viem";
import { MTK_TOKEN, ERC20_APPROVAL_ABI, ZERO_ADDRESS } from "@/lib/constants/tokens";

// Remove the MTK_TOKEN and ERC20_APPROVAL_ABI constants as they're now imported

export function useMatch() {
  const contract = useContract();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Function to check and approve token allowance
  const checkAndApproveToken = async (tokenAddress: `0x${string}`, amount: bigint) => {
    if (!walletClient || !publicClient || !contract) return false;

    try {
      // Check current allowance
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "allowance",
        args: [walletClient.account.address, contract.address]
      });

      // If allowance is sufficient, return true
      if (allowance >= amount) {
        return true;
      }

      // Otherwise, request approval
      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "approve",
        args: [contract.address, amount],
        account: walletClient.account.address
      });

      const hash = await walletClient.writeContract(request);
      
      // Wait for the approval transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt.status === "success";
    } catch (error) {
      console.error("Error approving token:", error);
      throw new Error("Failed to approve token. Please try again.");
    }
  };

  const createMatch = async (amount: bigint, tokenAddress?: `0x${string}`) => {
    if (!contract || !walletClient) return;

    try {
      // Use the imported ZERO_ADDRESS constant
      const token = tokenAddress || ZERO_ADDRESS;
      const isERC20 = token !== ZERO_ADDRESS;

      // If using ERC20 token, check and approve allowance first
      if (isERC20) {
        const approved = await checkAndApproveToken(token, amount);
        if (!approved) {
          throw new Error("Token approval failed or was rejected");
        }
      }

      const { request } = await contract.simulate.startMatch(
        [amount, token],
        {
          account: walletClient.account.address,
          // Only include value if using ETH, not for ERC20 tokens
          value: isERC20 ? 0n : amount,
          gas: await contract.estimateGas.startMatch(
            [amount, token],
            { account: walletClient.account.address, value: isERC20 ? 0n : amount }
          ),
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating match:", error);
      if (error instanceof BaseError && error.message?.includes('CORS')) {
        throw new Error('Network connection issue. Please try again.');
      }
      throw error;
    }
  };

  const create2v2Match = async (amount: bigint, tokenAddress?: `0x${string}`) => {
    if (!contract || !walletClient) return;

    try {
      // Use the imported ZERO_ADDRESS constant
      const token = tokenAddress || ZERO_ADDRESS;
      const isERC20 = token !== ZERO_ADDRESS;

      // If using ERC20 token, check and approve allowance first
      if (isERC20) {
        const approved = await checkAndApproveToken(token, amount);
        if (!approved) {
          throw new Error("Token approval failed or was rejected");
        }
      }

      const { request } = await contract.simulate.start2v2Match(
        [amount, token],
        {
          account: walletClient.account.address,
          // Only include value if using ETH, not for ERC20 tokens
          value: isERC20 ? 0n : amount,
          gas: await contract.estimateGas.start2v2Match(
            [amount, token],
            { account: walletClient.account.address, value: isERC20 ? 0n : amount }
          ),
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating 2v2 match:", error);
      if (error instanceof BaseError && error.message?.includes('CORS')) {
        throw new Error('Network connection issue. Please try again.');
      }
      throw error;
    }
  };

  const create5v5Match = async (amount: bigint, tokenAddress?: `0x${string}`) => {
    if (!contract || !walletClient) return;

    try {
      // Use the imported ZERO_ADDRESS constant
      const token = tokenAddress || ZERO_ADDRESS;
      const isERC20 = token !== ZERO_ADDRESS;

      // If using ERC20 token, check and approve allowance first
      if (isERC20) {
        const approved = await checkAndApproveToken(token, amount);
        if (!approved) {
          throw new Error("Token approval failed or was rejected");
        }
      }

      const { request } = await contract.simulate.start5v5Match(
        [amount, token],
        {
          account: walletClient.account.address,
          // Only include value if using ETH, not for ERC20 tokens
          value: isERC20 ? 0n : amount,
          gas: await contract.estimateGas.start5v5Match(
            [amount, token],
            { account: walletClient.account.address, value: isERC20 ? 0n : amount }
          ),
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating 5v5 match:", error);
      if (error instanceof BaseError && error.message?.includes('CORS')) {
        throw new Error('Network connection issue. Please try again.');
      }
      throw error;
    }
  };

  const joinMatch = async (matchId: bigint, amount: bigint) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.joinMatch([matchId], {
        account: walletClient.account.address,
        value: amount,
      });
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error joining match:", error);
      throw error;
    }
  };

  const join2v2Team = async (
    matchId: bigint,
    isTeamA: boolean,
    amount: bigint
  ) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.join2v2Team(
        [matchId, isTeamA],
        {
          account: walletClient.account.address,
          value: amount,
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error joining 2v2 team:", error);
      throw error;
    }
  };

  const join5v5Team = async (
    matchId: bigint,
    isTeamA: boolean,
    amount: bigint
  ) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.join5v5Team(
        [matchId, isTeamA],
        {
          account: walletClient.account.address,
          value: amount,
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error joining 5v5 team:", error);
      throw error;
    }
  };

  return {
    createMatch,
    create2v2Match,
    create5v5Match,
    joinMatch,
    join2v2Team,
    join5v5Team,
    checkAndApproveToken,
  };
}
