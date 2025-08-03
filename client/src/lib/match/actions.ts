import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../contracts/abis/ABI";
import { ethers } from "ethers";
import { ERC20_APPROVAL_ABI } from "../constants/tokens";

// Type for Privy's sendTransaction function - using a more specific type
type SendTransactionFunction = (request: {
  address: `0x${string}`;
  abi: unknown;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}) => Promise<`0x${string}`>;

// Helper function to check and approve token allowance
async function checkAndApproveToken(
  tokenAddress: `0x${string}`,
  amount: bigint,
  contractAddress: `0x${string}`,
  walletAddress: `0x${string}`,
  publicClient: PublicClient
) {
  try {
    console.log(`[TOKEN-APPROVAL] Checking allowance for token ${tokenAddress}`);
    console.log(`[TOKEN-APPROVAL] Amount needed: ${amount}`);
    console.log(`[TOKEN-APPROVAL] Contract address: ${contractAddress}`);
    console.log(`[TOKEN-APPROVAL] Wallet address: ${walletAddress}`);

    // Check standard ERC20 allowance
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_APPROVAL_ABI,
      functionName: "allowance",
      args: [walletAddress, contractAddress]
    });
    console.log(`[TOKEN-APPROVAL] Current allowance: ${allowance}`);

    // Check if the token is approved in the contract's internal system
    const isTokenApproved = await publicClient.readContract({
      address: contractAddress,
      abi: ONEVONE_ABI,
      functionName: "approvedTokens",
      args: [tokenAddress]
    });
    console.log(`[TOKEN-APPROVAL] Token approved in contract: ${isTokenApproved}`);

    // If both allowance and contract approval are sufficient, return true
    if (allowance >= amount && isTokenApproved) {
      console.log(`[TOKEN-APPROVAL] Sufficient allowance and contract approval: ${allowance.toString()}`);
      return true;
    }

    console.log(`[TOKEN-APPROVAL] Token approval needed. Allowance: ${allowance} >= ${amount} = ${allowance >= amount}, Contract approved: ${isTokenApproved}`);

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);

      // Request accounts to ensure wallet is connected (same as useMatch.ts)
      await provider.send("eth_requestAccounts", []);

      // Get the signer for account 0 (same as useMatch.ts)
      const signer = provider.getSigner(0);

      // If standard ERC20 allowance is insufficient, approve it
      if (allowance < amount) {
        console.log(`[TOKEN-APPROVAL] Standard ERC20 allowance insufficient. Requesting approval...`);
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_APPROVAL_ABI,
          signer
        );

        console.log(`[TOKEN-APPROVAL] Sending ERC20 approval transaction...`);
        const tx = await tokenContract.approve(contractAddress, amount.toString());
        console.log(`[TOKEN-APPROVAL] ERC20 approval transaction hash: ${tx.hash}`);

        console.log(`[TOKEN-APPROVAL] Waiting for ERC20 approval transaction confirmation...`);
        try {
          const receipt = await tx.wait();
          console.log(`[TOKEN-APPROVAL] ERC20 approval confirmed in block: ${receipt.blockNumber}`);
        } catch (error) {
          console.log(`[TOKEN-APPROVAL] Rate limited while waiting for confirmation, but transaction was sent: ${tx.hash}`);
          console.log(`[TOKEN-APPROVAL] Continuing without waiting for confirmation...`);
        }
      }

      // If token is not approved in contract, approve it (requires admin privileges)
      if (!isTokenApproved) {
        console.log(`[TOKEN-APPROVAL] Token not approved in contract. Attempting to approve...`);

        // Check if the current user is the contract owner or admin
        const contractOwner = await publicClient.readContract({
          address: contractAddress,
          abi: ONEVONE_ABI,
          functionName: "owner",
        }) as `0x${string}`;

        console.log(`[TOKEN-APPROVAL] Contract owner: ${contractOwner}, Current signer: ${walletAddress}`);

        if (contractOwner.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`[TOKEN-APPROVAL] Current user is contract owner. Approving token in contract...`);
          const contractInstance = new ethers.Contract(contractAddress, ONEVONE_ABI, signer);
          const approveTx = await contractInstance.approveToken(tokenAddress, true);
          console.log(`[TOKEN-APPROVAL] Contract approval transaction hash: ${approveTx.hash}`);

          console.log(`[TOKEN-APPROVAL] Waiting for contract approval confirmation...`);
          const approveReceipt = await approveTx.wait();
          console.log(`[TOKEN-APPROVAL] Contract approval confirmed in block: ${approveReceipt.blockNumber}`);
        } else {
          console.log(`[TOKEN-APPROVAL] Current user is not contract owner. Cannot approve token in contract.`);
          console.log(`[TOKEN-APPROVAL] This token needs to be approved by the contract owner: ${contractOwner}`);
          throw new Error(`Token ${tokenAddress} is not approved in the contract. Please contact the contract owner to approve this token.`);
        }
      }

      console.log(`[TOKEN-APPROVAL] Waiting for blockchain state update...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify both approvals are now in place
      const newAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "allowance",
        args: [walletAddress, contractAddress]
      });

      const newIsTokenApproved = await publicClient.readContract({
        address: contractAddress,
        abi: ONEVONE_ABI,
        functionName: "approvedTokens",
        args: [tokenAddress]
      });

      console.log(`[TOKEN-APPROVAL] New allowance after approval: ${newAllowance}`);
      console.log(`[TOKEN-APPROVAL] New contract approval status: ${newIsTokenApproved}`);

      if (newAllowance >= amount && newIsTokenApproved) {
        console.log(`[TOKEN-APPROVAL] All approvals successful!`);
        return true;
      } else {
        throw new Error(`Approval failed. New allowance: ${newAllowance} >= ${amount} = ${newAllowance >= amount}, Contract approved: ${newIsTokenApproved}`);
      }
    } else {
      throw new Error("No external wallet available for token approval");
    }
  } catch (error) {
    console.error("[TOKEN-APPROVAL] Error approving token:", error);
    throw new Error("Failed to approve token. Please try again.");
  }
}

// Utility function to approve tokens in the contract (for contract owner use)
export async function approveTokenInContract(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  tokenAddress: `0x${string}`,
  isApproved: boolean = true
) {
  console.log(`[TOKEN-APPROVAL-UTIL] Approving token ${tokenAddress} in contract: ${isApproved}`);

  try {
    // Check if the token is already approved
    const currentApproval = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "approvedTokens",
      args: [tokenAddress]
    });

    console.log(`[TOKEN-APPROVAL-UTIL] Current approval status: ${currentApproval}`);

    if (currentApproval === isApproved) {
      console.log(`[TOKEN-APPROVAL-UTIL] Token already has desired approval status`);
      return true;
    }

    // Call the approveToken function
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "approveToken",
      args: [tokenAddress, isApproved],
    });

    console.log(`[TOKEN-APPROVAL-UTIL] Sending approval transaction...`);
    const hash = await sendTransaction(request);
    console.log(`[TOKEN-APPROVAL-UTIL] Approval transaction hash: ${hash}`);

    return hash;
  } catch (error) {
    console.error("[TOKEN-APPROVAL-UTIL] Error approving token in contract:", error);
    throw new Error("Failed to approve token in contract. Please try again.");
  }
}

export async function joinMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  amount: bigint,
  walletAddress?: `0x${string}`
) {
  console.log(`[JOIN-MATCH-DEBUG] Function called with matchId: ${matchId}, amount: ${amount}`);

  console.log(`[JOIN-MATCH] Starting joinMatch for match ${matchId} with amount ${amount}`);

  const match = await publicClient.readContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "matches",
    args: [matchId]
  }) as readonly [
    `0x${string}`, // player1
    `0x${string}`, // player2
    bigint, // player1Amount
    bigint, // player2Amount
    bigint, // totalAmount
    bigint, // donatedAmount
    boolean, // isOpen
    boolean, // isClosed
    boolean, // isERC20
    `0x${string}` // token
  ];
  console.log(`[JOIN-MATCH] Raw match data:`, match);

  const isERC20 = match[8];
  const tokenAddress = match[9];

  console.log(`[JOIN-MATCH] Match ${matchId} details:`, {
    isERC20,
    tokenAddress,
    amount: amount.toString(),
    contractAddress: contract.address
  });

  console.log(`[JOIN-MATCH] ERC20 condition check:`, {
    isERC20,
    tokenAddress,
    isERC20Condition: isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000",
    zeroAddress: "0x0000000000000000000000000000000000000000"
  });

  if (isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    console.log(`[JOIN-MATCH] This is an ERC20 match. Checking for external wallet...`);
    if (typeof window !== "undefined" && (window as any).ethereum) {
      console.log(`[JOIN-MATCH] External wallet detected. Getting wallet address...`);
      let currentWalletAddress = walletAddress;

      if (!currentWalletAddress) {
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        const signer = provider.getSigner();
        currentWalletAddress = await signer.getAddress() as `0x${string}`;
      }

      console.log(`[JOIN-MATCH] Wallet address: ${currentWalletAddress}`);

      // Let's check if the smart contract has any ERC20-related state variables
      console.log(`[JOIN-MATCH] Checking smart contract for ERC20 handler...`);
      try {
        // Check if the contract has any ERC20 handler or token manager
        const contractOwner = await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "owner",
        });
        console.log(`[JOIN-MATCH] Contract owner: ${contractOwner}`);

        // Check if there's a token manager or ERC20 handler
        console.log(`[JOIN-MATCH] Contract address for ERC20 operations: ${contract.address}`);
      } catch (error) {
        console.log(`[JOIN-MATCH] Could not read contract owner:`, error);
      }

      console.log(`[JOIN-MATCH] Calling checkAndApproveToken...`);
      await checkAndApproveToken(tokenAddress, amount, contract.address, currentWalletAddress, publicClient);
      console.log(`[JOIN-MATCH] Token approval completed successfully.`);

      // Add a small delay to ensure blockchain state is updated
      console.log(`[JOIN-MATCH] Waiting for blockchain state update...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log(`[JOIN-MATCH] No external wallet available for ERC20 match`);
      throw new Error("External wallet required for ERC20 token matches");
    }

    // Now call the joinMatch function without ETH value
    console.log(`[JOIN-MATCH] Proceeding with join match transaction...`);

    // Use ethers.js approach like in match creation
    if (typeof window !== "undefined" && (window as any).ethereum) {
      console.log(`[JOIN-MATCH] Using ethers.js for join match transaction...`);

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const ethersContract = new ethers.Contract(contract.address, contract.abi, signer);

      // Prepare transaction options
      const txOptions: { value?: ethers.BigNumber } = {};
      if (!isERC20) {
        txOptions.value = ethers.BigNumber.from(amount.toString());
      }

      console.log(`[JOIN-MATCH] Sending join match transaction with ethers.js...`);
      console.log(`[JOIN-MATCH] Contract address: ${ethersContract.address}`);
      console.log(`[JOIN-MATCH] Function parameters:`, {
        matchId: matchId.toString(),
        txOptions: txOptions
      });

      const tx = await ethersContract.joinMatch(matchId.toString(), txOptions);
      console.log(`[JOIN-MATCH] Transaction sent with hash: ${tx.hash}`);

      // Wait for transaction confirmation
      console.log(`[JOIN-MATCH] Waiting for transaction confirmation...`);
      const receipt = await tx.wait();
      console.log(`[JOIN-MATCH] Transaction confirmed in block: ${receipt.blockNumber}`);

      return tx.hash;
    } else {
      throw new Error("No external wallet available for join match transaction");
    }
  } else {
    // For ETH matches, use ethers.js directly for external wallets
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const ethersContract = new ethers.Contract(contract.address, contract.abi, signer);
      const tx = await ethersContract.joinMatch(matchId, { value: ethers.BigNumber.from(amount.toString()) });
      return tx.hash;
    } else {
      // Fallback to sendTransaction (for embedded wallets)
      const { request } = await publicClient.simulateContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "joinMatch",
        args: [matchId],
        value: amount,
      });
      return sendTransaction(request);
    }
  }
}

export async function join2v2Team(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  isTeamA: boolean,
  amount: bigint
) {
  // Get match details to check if it uses ERC20 tokens
  const match = await publicClient.readContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "matches2v2",
    args: [matchId]
  }) as readonly [
    `0x${string}`, // player1
    `0x${string}`, // player2
    `0x${string}`, // teamAPlayer2
    `0x${string}`, // teamBPlayer2
    bigint, // player1Amount
    bigint, // player2Amount
    bigint, // totalAmount
    bigint, // donatedAmount
    boolean, // isOpen
    boolean, // isERC20
    `0x${string}` // token
  ];

  const isERC20 = match[9];
  const tokenAddress = match[10];

  console.log(`2v2 Match ${matchId} is ${isERC20 ? "an ERC20" : "an ETH"} match with token ${tokenAddress}`);

  // If it's an ERC20 match, approve tokens first
  if (isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    // Get the user's wallet address from the current context
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress() as `0x${string}`;

      // Check and approve token allowance
      await checkAndApproveToken(tokenAddress, amount, contract.address, walletAddress, publicClient);
    }

    // For ERC20 matches, send without ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join2v2Team",
      args: [matchId, isTeamA],
    });

    return sendTransaction(request);
  } else {
    // For ETH matches, include the ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join2v2Team",
      args: [matchId, isTeamA],
      value: amount,
    });

    return sendTransaction(request);
  }
}

export async function join6v6Team(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  isTeamA: boolean,
  amount: bigint
) {
  // Get match details to check if it uses ERC20 tokens
  const match6v6 = await publicClient.readContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "matches6v6",
    args: [matchId],
  }) as readonly [
    `0x${string}`, // player1
    `0x${string}`, // teamAPlayer2
    `0x${string}`, // teamAPlayer3
    `0x${string}`, // teamAPlayer4
    `0x${string}`, // teamAPlayer5
    `0x${string}`, // teamAPlayer6
    `0x${string}`, // player2
    `0x${string}`, // teamBPlayer2
    `0x${string}`, // teamBPlayer3
    `0x${string}`, // teamBPlayer4
    `0x${string}`, // teamBPlayer5
    `0x${string}`, // teamBPlayer6
    bigint, // player1Amount
    bigint, // totalAmount
    bigint, // donatedAmount
    `0x${string}`, // token
    boolean, // isERC20
    boolean, // isOpen
    boolean // isClosed
  ];

  if (!match6v6) {
    throw new Error("Match not found");
  }

  const isERC20 = match6v6[16];
  const tokenAddress = match6v6[15];

  console.log(`6v6 Match ${matchId} is ${isERC20 ? "an ERC20" : "an ETH"} match with token ${tokenAddress}`);

  // If it's an ERC20 match, approve tokens first
  if (isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    // Get the user's wallet address from the current context
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress() as `0x${string}`;

      // Check and approve token allowance
      await checkAndApproveToken(tokenAddress, amount, contract.address, walletAddress, publicClient);
    }

    // For ERC20 matches, send without ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join6v6Team",
      args: [matchId, isTeamA],
    });

    return sendTransaction(request);
  } else {
    // For ETH matches, include the ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join6v6Team",
      args: [matchId, isTeamA],
      value: amount,
    });

    return sendTransaction(request);
  }
}

export async function donateToMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  amount: bigint
) {
  // Check match state in all match types to determine if it's open
  const [match1v1, match2v2, match6v6] = await Promise.all([
    // Check 1v1 match
    publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "matches",
      args: [matchId],
    }) as Promise<
      readonly [
        `0x${string}`, // player1
        `0x${string}`, // player2
        bigint, // player1Amount
        bigint, // player2Amount
        bigint, // totalAmount
        bigint, // donatedAmount
        boolean, // isOpen
        boolean, // isClosed
        boolean, // isERC20
        `0x${string}` // token
      ]
    >,
    // Check 2v2 match
    publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "matches2v2",
      args: [matchId],
    }) as Promise<
      readonly [
        `0x${string}`, // player1
        `0x${string}`, // player2
        `0x${string}`, // teamAPlayer2
        `0x${string}`, // teamBPlayer2
        bigint, // player1Amount
        bigint, // player2Amount
        bigint, // totalAmount
        bigint, // donatedAmount
        boolean, // isOpen
        boolean, // isERC20
        `0x${string}` // token
      ]
    >,
    // Check 6v6 match
    publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "matches6v6",
      args: [matchId],
    }) as Promise<
      readonly [
        `0x${string}`, // player1
        `0x${string}`, // teamAPlayer2
        `0x${string}`, // teamAPlayer3
        `0x${string}`, // teamAPlayer4
        `0x${string}`, // teamAPlayer5
        `0x${string}`, // teamAPlayer6
        `0x${string}`, // player2
        `0x${string}`, // teamBPlayer2
        `0x${string}`, // teamBPlayer3
        `0x${string}`, // teamBPlayer4
        `0x${string}`, // teamBPlayer5
        `0x${string}`, // teamBPlayer6
        bigint, // player1Amount
        bigint, // totalAmount
        bigint, // donatedAmount
        `0x${string}`, // token
        boolean, // isERC20
        boolean, // isOpen
        boolean // isClosed
      ]
    >,
  ]);

  // Check if any of the match types are closed (donations should be allowed until explicitly closed)
  // For 1v1: isClosed is at index 7, for 2v2: isClosed is at index 9, for 6v6: isClosed is at index 18
  const isMatchClosed = (match1v1 && (match1v1 as any)[7]) || (match2v2 && (match2v2 as any)[9]) || (match6v6 && (match6v6 as any)[18]);

  console.log(`[DONATE-MATCH] Match closed status check:`, {
    match1v1: match1v1 ? `exists, isClosed: ${(match1v1 as any)[7]}` : "null",
    match2v2: match2v2 ? `exists, isClosed: ${(match2v2 as any)[9]}` : "null",
    match6v6: match6v6 ? `exists, isClosed: ${(match6v6 as any)[18]}` : "null",
    isMatchClosed
  });

  if (isMatchClosed) {
    throw new Error("This match is closed and no longer accepting donations");
  }

  // Determine match type and get token info
  let tokenAddress: `0x${string}` | null = null;
  let isERC20 = false;

  if (match1v1 && (match1v1 as any)[0] !== '0x0000000000000000000000000000000000000000') {
    isERC20 = (match1v1 as any)[8]; // isERC20 is at index 8 for 1v1
    tokenAddress = (match1v1 as any)[9]; // token is at index 9 for 1v1
  } else if (match2v2 && (match2v2 as any)[0] !== '0x0000000000000000000000000000000000000000') {
    isERC20 = (match2v2 as any)[9]; // isERC20 is at index 9 for 2v2
    tokenAddress = (match2v2 as any)[10]; // token is at index 10 for 2v2
  } else if (match6v6 && (match6v6 as any)[0] !== '0x0000000000000000000000000000000000000000') {
    isERC20 = (match6v6 as any)[16]; // isERC20 is at index 16 for 6v6
    tokenAddress = (match6v6 as any)[15]; // token is at index 15 for 6v6
  }

  console.log(`[DONATE-MATCH] Token info:`, {
    isERC20,
    tokenAddress,
    amount: amount.toString()
  });

  // If it's an ERC20 token, check and approve token allowance
  if (isERC20 && tokenAddress) {
    console.log(`[DONATE-MATCH] ERC20 token detected. Checking approval...`);

    // Get wallet address for approval
    let walletAddress: `0x${string}`;
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner(0);
      walletAddress = await signer.getAddress() as `0x${string}`;
    } else {
      throw new Error("No wallet connected");
    }

    // Check and approve token
    await checkAndApproveToken(tokenAddress, amount, contract.address, walletAddress, publicClient);

    // Add a longer delay to ensure blockchain state is updated and avoid rate limiting
    console.log(`[DONATE-MATCH] Waiting for blockchain state update...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Use ethers.js approach for ERC20 donations (same as joinMatch)
  if (isERC20 && tokenAddress) {
    console.log(`[DONATE-MATCH] Using ethers.js for ERC20 donation transaction...`);

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const contractInstance = new ethers.Contract(contract.address, contract.abi, signer);
      const tx = await contractInstance.donateToMatch(matchId, amount, { value: 0 }); // 0 ETH value for ERC20

      console.log(`[DONATE-MATCH] ERC20 donation transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`[DONATE-MATCH] ERC20 donation confirmed in block: ${receipt.blockNumber}`);

      return receipt.transactionHash as `0x${string}`;
    } else {
      throw new Error("No wallet connected for ERC20 donation");
    }
  }

  // For ETH donations, use the original approach
  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "donateToMatch",
    args: [matchId, amount],
    value: amount, // Full ETH value for ETH donations
  });

  return sendTransaction(request);
}

export async function closeMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  winner: `0x${string}`,
  callerAddress?: `0x${string}`
) {
  try {
    console.log(`[CLOSE-MATCH] Function called with params:`, {
      contractAddress: contract.address,
      matchId,
      winner,
      callerAddress
    });
    // Log the caller address for debugging
    console.log(`[CLOSE-MATCH] Caller address: ${callerAddress}`);
    console.log(`[CLOSE-MATCH] Contract address: ${contract.address}`);
    console.log(`[CLOSE-MATCH] Match ID: ${matchId}`);
    console.log(`[CLOSE-MATCH] Winner: ${winner}`);

    // First, determine the match type by checking all match types
    const [match1v1, match2v2, match6v6] = await Promise.all([
      // Check 1v1 match
      publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches",
        args: [matchId],
      }).catch(() => null),

      // Check 2v2 match
      publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches2v2",
        args: [matchId],
      }).catch(() => null),

      // Check 5v5 match
      publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "matches6v6",
        args: [matchId],
      }).catch(() => null),
    ]);

    console.log(`[CLOSE-MATCH] Match type check:`, {
      match1v1: match1v1 ? "exists" : "null",
      match2v2: match2v2 ? "exists" : "null",
      match6v6: match6v6 ? "exists" : "null"
    });

    // Determine match type and call appropriate close function
    let closeFunction: string;
    let args: any[];

    if (match1v1 && (match1v1 as any)[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "closeMatch";
      args = [matchId, winner];
      console.log(`[CLOSE-MATCH] Using closeMatch for 1v1`);
    } else if (match2v2 && (match2v2 as any)[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "close2v2Match";
      args = [matchId, winner];
      console.log(`[CLOSE-MATCH] Using close2v2Match for 2v2`);
    } else if (match6v6 && (match6v6 as any)[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "close6v6Match";
      args = [matchId, winner];
      console.log(`[CLOSE-MATCH] Using close6v6Match for 6v6`);
    } else {
      throw new Error(`No match found with ID ${matchId}`);
    }

    // Check admin status right before the transaction
    console.log(`[CLOSE-MATCH] Checking admin status before transaction...`);
    const isAdmin = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "isAdmin",
      args: [callerAddress as `0x${string}`],
    });
    console.log(`[CLOSE-MATCH] Caller ${callerAddress} is admin: ${isAdmin}`);

    // Check owner status
    const owner = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "owner",
    });
    console.log(`[CLOSE-MATCH] Contract owner: ${owner}`);
    console.log(`[CLOSE-MATCH] Caller is owner: ${callerAddress === owner}`);

    // Use ethers.js for external wallets, fallback to sendTransaction for embedded wallets
    if (typeof window !== "undefined" && (window as any).ethereum) {
      console.log(`[CLOSE-MATCH] Using ethers.js for external wallet`);
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const ethersContract = new ethers.Contract(contract.address, contract.abi, signer);

      let tx;
      if (closeFunction === "closeMatch") {
        tx = await ethersContract.closeMatch(matchId, winner);
      } else if (closeFunction === "close2v2Match") {
        tx = await ethersContract.close2v2Match(matchId, winner);
      } else if (closeFunction === "close5v5Match") {
        tx = await ethersContract.close5v5Match(matchId, winner);
      } else {
        throw new Error(`Unknown close function: ${closeFunction}`);
      }

      console.log(`[CLOSE-MATCH] Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`[CLOSE-MATCH] Transaction receipt:`, receipt);
      return tx.hash;
    } else {
      console.log(`[CLOSE-MATCH] Using sendTransaction for embedded wallet`);
      // Fallback to sendTransaction (for embedded wallets)
      const { request } = await publicClient.simulateContract({
        address: contract.address,
        abi: contract.abi,
        functionName: closeFunction as any,
        args: args as any,
        account: callerAddress as `0x${string}`,
      });
      const hash = await sendTransaction(request);
      console.log(`[CLOSE-MATCH] Transaction hash (embedded):`, hash);
      // Optionally, wait for receipt if possible
      return hash;
    }
  } catch (error) {
    console.error(`[CLOSE-MATCH] Error:`, error);
    throw error;
  }
}