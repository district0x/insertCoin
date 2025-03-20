import { useContract } from "./useContract";
import { useWalletClient, usePublicClient } from "wagmi";
import { BaseError, formatEther } from "viem";
import { ERC20_APPROVAL_ABI, ZERO_ADDRESS } from "@/lib/constants/tokens";
import { useToast } from "@/hooks/use-toast";

// Remove the MTK_TOKEN and ERC20_APPROVAL_ABI constants as they're now imported

export function useMatch() {
  const contract = useContract();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { toast } = useToast();

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
      toast({
        title: "Token Approval Required",
        description: "Please approve the contract to spend your tokens.",
        duration: 10000,
      });
      
      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "approve",
        args: [contract.address, amount],
        account: walletClient.account.address
      });

      const hash = await walletClient.writeContract(request);
      
      toast({
        title: "Approval Transaction Submitted",
        description: "Waiting for token approval confirmation...",
        duration: 15000,
      });
      
      // Wait for the approval transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        // Increase timeout for Base Sepolia
        timeout: 180000, // 3 minutes
        pollingInterval: 3000,
        confirmations: 1
      });
      
      if (receipt.status === "success") {
        toast({
          title: "Token Approval Successful",
          description: "You can now create the match.",
          variant: "success",
          duration: 5000,
        });
        return true;
      } else {
        toast({
          title: "Token Approval Failed",
          description: "The approval transaction failed. Please try again.",
          variant: "destructive",
          duration: 7000,
        });
        return false;
      }
    } catch (error) {
      console.error("Error approving token:", error);
      
      // Handle timeout errors specially
      if (error instanceof Error && error.message.includes("Timed out")) {
        toast({
          title: "Token Approval Taking Longer Than Expected",
          description: "The approval transaction is taking longer than expected to confirm on Base Sepolia. Please check your wallet for the transaction status.",
          variant: "destructive",
          duration: 10000,
        });
        throw new Error("Transaction confirmation timed out. The transaction might still succeed - please check your wallet or explorer.");
      } else {
        toast({
          title: "Token Approval Error",
          description: error instanceof Error ? error.message : "Failed to approve token. Please try again.",
          variant: "destructive",
          duration: 7000,
        });
        throw new Error("Failed to approve token. Please try again.");
      }
    }
  };

  const createMatch = async (amount: bigint, tokenAddress?: `0x${string}`) => {
    if (!contract || !walletClient) return;
    
    try {
      // Log the network we're connected to
      console.log("Creating match on network:", publicClient?.chain?.name, publicClient?.chain?.id);
      
      // Validate amount
      if (amount <= 0n) {
        throw new Error("Stake amount must be greater than 0");
      }
      
      // Max reasonable stake amount (100,000 ETH)
      const MAX_STAKE = 100000n * 10n ** 18n;
      if (amount > MAX_STAKE) {
        throw new Error(`Stake amount exceeds maximum allowed (${formatEther(MAX_STAKE)} ETH)`);
      }
      
      // Use the imported ZERO_ADDRESS constant for ETH
      const token = tokenAddress || ZERO_ADDRESS;
      const isERC20 = token !== ZERO_ADDRESS;
      
      console.log("Transaction parameters:", {
        amount: amount.toString(),
        token,
        isERC20,
        userAddress: walletClient.account.address,
        contractAddress: contract.address
      });

      // If using ERC20 token, check and approve allowance first
      if (isERC20) {
        const approved = await checkAndApproveToken(token, amount);
        if (!approved) {
          throw new Error("Token approval failed or was rejected");
        }
      }

      // Prepare contract call parameters and handle ETH value properly
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
      
      console.log("Sending transaction to start match...");
      const hash = await walletClient.writeContract(request);
      console.log("Transaction sent with hash:", hash);
      return hash;
    } catch (error) {
      console.error("Error creating match:", error);
      if (error instanceof BaseError) {
        // Log detailed error info
        console.error("BaseError details:", {
          name: error.name,
          message: error.message,
          cause: error.cause
        });
        
        if (error.message?.includes('CORS')) {
          throw new Error('Network connection issue. Please try again.');
        }
        
        if (error.message?.includes('insufficient funds')) {
          throw new Error('Insufficient funds for transaction. Please check your balance and try again.');
        }
      }
      // Re-throw the error
      throw error;
    }
  };

  const create2v2Match = async (amount: bigint, tokenAddress?: `0x${string}`) => {
    if (!contract || !walletClient) return;

    try {
      // Log the network we're connected to
      console.log("Creating 2v2 match on network:", publicClient?.chain?.name, publicClient?.chain?.id);
      
      // Validate amount
      if (amount <= 0n) {
        throw new Error("Stake amount must be greater than 0");
      }
      
      // Max reasonable stake amount (100,000 ETH)
      const MAX_STAKE = 100000n * 10n ** 18n;
      if (amount > MAX_STAKE) {
        throw new Error(`Stake amount exceeds maximum allowed (${formatEther(MAX_STAKE)} ETH)`);
      }
      
      // Use the imported ZERO_ADDRESS constant for ETH
      const token = tokenAddress || ZERO_ADDRESS;
      const isERC20 = token !== ZERO_ADDRESS;
      
      console.log("Transaction parameters:", {
        amount: amount.toString(),
        token,
        isERC20,
        userAddress: walletClient.account.address,
        contractAddress: contract.address
      });

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
      
      console.log("Sending transaction to start 2v2 match...");
      const hash = await walletClient.writeContract(request);
      console.log("Transaction sent with hash:", hash);
      return hash;
    } catch (error) {
      console.error("Error creating 2v2 match:", error);
      if (error instanceof BaseError) {
        // Log detailed error info
        console.error("BaseError details:", {
          name: error.name,
          message: error.message,
          cause: error.cause
        });
        
        if (error.message?.includes('CORS')) {
          throw new Error('Network connection issue. Please try again.');
        }
        
        if (error.message?.includes('insufficient funds')) {
          throw new Error('Insufficient funds for transaction. Please check your balance and try again.');
        }
      }
      throw error;
    }
  };

  const create5v5Match = async (amount: bigint, tokenAddress?: `0x${string}`) => {
    if (!contract || !walletClient) return;

    try {
      // Log the network we're connected to
      console.log("Creating 5v5 match on network:", publicClient?.chain?.name, publicClient?.chain?.id);
      
      // Validate amount
      if (amount <= 0n) {
        throw new Error("Stake amount must be greater than 0");
      }
      
      // Max reasonable stake amount (100,000 ETH)
      const MAX_STAKE = 100000n * 10n ** 18n;
      if (amount > MAX_STAKE) {
        throw new Error(`Stake amount exceeds maximum allowed (${formatEther(MAX_STAKE)} ETH)`);
      }
      
      // Use the imported ZERO_ADDRESS constant for ETH
      const token = tokenAddress || ZERO_ADDRESS;
      const isERC20 = token !== ZERO_ADDRESS;
      
      console.log("Transaction parameters:", {
        amount: amount.toString(),
        token,
        isERC20,
        userAddress: walletClient.account.address,
        contractAddress: contract.address
      });

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
      
      console.log("Sending transaction to start 5v5 match...");
      const hash = await walletClient.writeContract(request);
      console.log("Transaction sent with hash:", hash);
      return hash;
    } catch (error) {
      console.error("Error creating 5v5 match:", error);
      if (error instanceof BaseError) {
        // Log detailed error info
        console.error("BaseError details:", {
          name: error.name,
          message: error.message,
          cause: error.cause
        });
        
        if (error.message?.includes('CORS')) {
          throw new Error('Network connection issue. Please try again.');
        }
        
        if (error.message?.includes('insufficient funds')) {
          throw new Error('Insufficient funds for transaction. Please check your balance and try again.');
        }
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
  };
}
