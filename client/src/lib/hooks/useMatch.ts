import { useContract } from "./useContract";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { BaseError, formatEther, createPublicClient, http } from "viem";
import { ERC20_APPROVAL_ABI, ZERO_ADDRESS } from "@/lib/constants/tokens";
import { useToast } from "@/hooks/use-toast";
import { baseSepolia } from "@/lib/config/chains";
import { useWalletConnection } from "./useWalletConnection";
import { ethers } from "ethers";
import { ONEVONE_ABI } from "@/lib/contracts/abis/ABI";

// Remove the MTK_TOKEN and ERC20_APPROVAL_ABI constants as they're now imported

export function useMatch() {
  const contract = useContract();
  const { user, sendTransaction } = usePrivy();
  const { wallets } = useWallets();
  const { toast } = useToast();
  const { address: walletAddress, isExternalWallet } = useWalletConnection();

  // Create a public client for reading contract state
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!),
  });

  // Helper function to get ethers provider and signer (like tournament project)
  const getEthersProvider = () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('Ethereum provider not available. Please ensure your wallet is connected.');
    }
    return new ethers.providers.Web3Provider((window as any).ethereum);
  };

  const getEthersSigner = async () => {
    // Always use window.ethereum for ethers.js compatibility
    const provider = getEthersProvider();

    // Request accounts to ensure wallet is connected
    await provider.send("eth_requestAccounts", []);

    // Get the signer for account 0
    return provider.getSigner(0);
  };

  // Helper function to get contract instance with ethers (like tournament project)
  const getEthersContract = async () => {
    if (!walletAddress) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    const signer = await getEthersSigner();
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

    if (!contractAddress) {
      throw new Error('Contract address not configured');
    }

    return new ethers.Contract(contractAddress, ONEVONE_ABI, signer);
  };

  // Function to check and approve token allowance
  const checkAndApproveToken = async (tokenAddress: `0x${string}`, amount: bigint) => {
    if (!walletAddress || !contract) return false;

    try {
      // Check current allowance
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "allowance",
        args: [walletAddress as `0x${string}`, contract.address]
      });

      // If allowance is sufficient, return true
      if (allowance >= amount) {
        return true;
      }

      // Otherwise, request approval using ethers
      toast({
        title: "Token Approval Required",
        description: "Please approve the contract to spend your tokens.",
        duration: 10000,
      });

      const signer = await getEthersSigner();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_APPROVAL_ABI,
        signer
      );

      const tx = await tokenContract.approve(contract.address, amount.toString());
      const receipt = await tx.wait();

      toast({
        title: "Token Approval Successful",
        description: "You can now create the match.",
        variant: "success",
        duration: 5000,
      });
      return true;
    } catch (error) {
      console.error("Error approving token:", error);
      toast({
        title: "Token Approval Error",
        description: error instanceof Error ? error.message : "Failed to approve token. Please try again.",
        variant: "destructive",
        duration: 7000,
      });
      throw new Error("Failed to approve token. Please try again.");
    }
  };

  const createMatch = async (amount: bigint, tokenAddress?: `0x${string}`) => {
    if (!contract || !walletAddress) {
      throw new Error("No external wallet available. Please connect your external wallet.");
    }

    // Check if user has an external wallet connected
    if (!isExternalWallet) {
      throw new Error("Please connect an external wallet (like MetaMask) to create matches. Embedded wallets are not supported for transactions.");
    }

    try {
      // Log the network we're connected to
      console.log("Creating match on network:", baseSepolia.name, baseSepolia.id);
      console.log("Using wallet address:", walletAddress);

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
        userAddress: walletAddress,
        contractAddress: contract.address
      });

      // If using ERC20 token, check and approve allowance first
      if (isERC20) {
        const approved = await checkAndApproveToken(token, amount);
        if (!approved) {
          throw new Error("Token approval failed or was rejected");
        }
      }

      // Use ethers contract like in tournament project
      const ethersContract = await getEthersContract();

      // Prepare transaction options
      const txOptions: { value?: ethers.BigNumber } = {};
      if (!isERC20) {
        txOptions.value = ethers.BigNumber.from(amount.toString());
      }

      console.log("Sending transaction to start match...");
      console.log("Contract address:", ethersContract.address);
      console.log("Function parameters:", {
        amount: amount.toString(),
        token: token,
        txOptions: txOptions
      });
      const tx = await ethersContract.startMatch(amount.toString(), token, txOptions);
      console.log("Transaction sent with hash:", tx.hash);

      return tx.hash;
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
    if (!contract || !walletAddress) {
      throw new Error("No external wallet available. Please connect your external wallet.");
    }

    // Check if user has an external wallet connected
    if (!isExternalWallet) {
      throw new Error("Please connect an external wallet (like MetaMask) to create matches. Embedded wallets are not supported for transactions.");
    }

    try {
      // Log the network we're connected to
      console.log("Creating 2v2 match on network:", baseSepolia.name, baseSepolia.id);

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
        userAddress: walletAddress,
        contractAddress: contract.address
      });

      // If using ERC20 token, check and approve allowance first
      if (isERC20) {
        const approved = await checkAndApproveToken(token, amount);
        if (!approved) {
          throw new Error("Token approval failed or was rejected");
        }
      }

      // Use ethers contract like in tournament project
      const ethersContract = getEthersContract();

      // Prepare transaction options
      const txOptions: { value?: ethers.BigNumber } = {};
      if (!isERC20) {
        txOptions.value = ethers.BigNumber.from(amount.toString());
      }

      console.log("Sending transaction to start 2v2 match...");
      const tx = await ethersContract.start2v2Match(amount.toString(), token, txOptions);
      console.log("Transaction sent with hash:", tx.hash);

      return tx.hash;
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
    if (!contract || !walletAddress) {
      throw new Error("No external wallet available. Please connect your external wallet.");
    }

    // Check if user has an external wallet connected
    if (!isExternalWallet) {
      throw new Error("Please connect an external wallet (like MetaMask) to create matches. Embedded wallets are not supported for transactions.");
    }

    try {
      // Log the network we're connected to
      console.log("Creating 5v5 match on network:", baseSepolia.name, baseSepolia.id);

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
        userAddress: walletAddress,
        contractAddress: contract.address
      });

      // If using ERC20 token, check and approve allowance first
      if (isERC20) {
        const approved = await checkAndApproveToken(token, amount);
        if (!approved) {
          throw new Error("Token approval failed or was rejected");
        }
      }

      // Use ethers contract like in tournament project
      const ethersContract = getEthersContract();

      // Prepare transaction options
      const txOptions: { value?: ethers.BigNumber } = {};
      if (!isERC20) {
        txOptions.value = ethers.BigNumber.from(amount.toString());
      }

      console.log("Sending transaction to start 5v5 match...");
      const tx = await ethersContract.start5v5Match(amount.toString(), token, txOptions);
      console.log("Transaction sent with hash:", tx.hash);

      return tx.hash;
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
    if (!contract || !walletAddress) {
      throw new Error("No external wallet available. Please connect your external wallet.");
    }

    if (!isExternalWallet) {
      throw new Error("Please connect an external wallet (like MetaMask) to join matches. Embedded wallets are not supported for transactions.");
    }

    try {
      const ethersContract = getEthersContract();
      const tx = await ethersContract.joinMatch(matchId.toString(), { value: ethers.BigNumber.from(amount.toString()) });
      return tx.hash;
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
    if (!contract || !walletAddress) {
      throw new Error("No external wallet available. Please connect your external wallet.");
    }

    if (!isExternalWallet) {
      throw new Error("Please connect an external wallet (like MetaMask) to join matches. Embedded wallets are not supported for transactions.");
    }

    try {
      const ethersContract = getEthersContract();
      const tx = await ethersContract.join2v2Team(matchId.toString(), isTeamA, { value: ethers.BigNumber.from(amount.toString()) });
      return tx.hash;
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
    if (!contract || !walletAddress) {
      throw new Error("No external wallet available. Please connect your external wallet.");
    }

    if (!isExternalWallet) {
      throw new Error("Please connect an external wallet (like MetaMask) to join matches. Embedded wallets are not supported for transactions.");
    }

    try {
      const ethersContract = getEthersContract();
      const tx = await ethersContract.join5v5Team(matchId.toString(), isTeamA, { value: ethers.BigNumber.from(amount.toString()) });
      return tx.hash;
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
