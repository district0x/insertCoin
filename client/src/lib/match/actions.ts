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

const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

// Helper function to check and approve token allowance
async function checkAndApproveToken(
  tokenAddress: `0x${string}`,
  amount: bigint,
  contractAddress: `0x${string}`,
  walletAddress: `0x${string}`,
  publicClient: PublicClient
) {
  try {
    devLog(`[TOKEN-APPROVAL] Checking allowance for token ${tokenAddress}`);
    devLog(`[TOKEN-APPROVAL] Amount needed: ${amount}`);
    devLog(`[TOKEN-APPROVAL] Contract address: ${contractAddress}`);
    devLog(`[TOKEN-APPROVAL] Wallet address: ${walletAddress}`);

    // Check standard ERC20 allowance
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_APPROVAL_ABI,
      functionName: "allowance",
      args: [walletAddress, contractAddress]
    });
    devLog(`[TOKEN-APPROVAL] Current allowance: ${allowance}`);

    // Check if the token is approved in the contract's internal system
    const isTokenApproved = await publicClient.readContract({
      address: contractAddress,
      abi: ONEVONE_ABI,
      functionName: "approvedTokens",
      args: [tokenAddress]
    });
    devLog(`[TOKEN-APPROVAL] Token approved in contract: ${isTokenApproved}`);

    // If both allowance and contract approval are sufficient, return true
    if (allowance >= amount && isTokenApproved) {
      devLog(`[TOKEN-APPROVAL] Sufficient allowance and contract approval: ${allowance.toString()}`);
      return true;
    }

    devLog(`[TOKEN-APPROVAL] Token approval needed. Allowance: ${allowance} >= ${amount} = ${allowance >= amount}, Contract approved: ${isTokenApproved}`);

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);

      // Request accounts to ensure wallet is connected (same as useMatch.ts)
      await provider.send("eth_requestAccounts", []);

      // Get the signer for account 0 (same as useMatch.ts)
      const signer = provider.getSigner(0);

      // If standard ERC20 allowance is insufficient, approve it
      if (allowance < amount) {
        devLog(`[TOKEN-APPROVAL] Standard ERC20 allowance insufficient. Requesting approval...`);
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_APPROVAL_ABI,
          signer
        );

        devLog(`[TOKEN-APPROVAL] Sending ERC20 approval transaction...`);
        const tx = await tokenContract.approve(contractAddress, amount.toString());
        devLog(`[TOKEN-APPROVAL] ERC20 approval transaction hash: ${tx.hash}`);

        devLog(`[TOKEN-APPROVAL] Waiting for ERC20 approval transaction confirmation...`);
        try {
          const receipt = await tx.wait();
          devLog(`[TOKEN-APPROVAL] ERC20 approval confirmed in block: ${receipt.blockNumber}`);
        } catch (error) {
          devLog(`[TOKEN-APPROVAL] Rate limited while waiting for confirmation, but transaction was sent: ${tx.hash}`);
          devLog(`[TOKEN-APPROVAL] Continuing without waiting for confirmation...`);
        }
      }

      // If token is not approved in contract, approve it (requires admin privileges)
      if (!isTokenApproved) {
        devLog(`[TOKEN-APPROVAL] Token not approved in contract. Attempting to approve...`);

        // Check if the current user is the contract owner or admin
        const contractOwner = await publicClient.readContract({
          address: contractAddress,
          abi: ONEVONE_ABI,
          functionName: "owner",
        }) as `0x${string}`;

        devLog(`[TOKEN-APPROVAL] Contract owner: ${contractOwner}, Current signer: ${walletAddress}`);

        if (contractOwner.toLowerCase() === walletAddress.toLowerCase()) {
          devLog(`[TOKEN-APPROVAL] Current user is contract owner. Approving token in contract...`);
          const contractInstance = new ethers.Contract(contractAddress, ONEVONE_ABI, signer);
          const approveTx = await contractInstance.approveToken(tokenAddress, true);
          devLog(`[TOKEN-APPROVAL] Contract approval transaction hash: ${approveTx.hash}`);

          devLog(`[TOKEN-APPROVAL] Waiting for contract approval confirmation...`);
          const approveReceipt = await approveTx.wait();
          devLog(`[TOKEN-APPROVAL] Contract approval confirmed in block: ${approveReceipt.blockNumber}`);
        } else {
          devLog(`[TOKEN-APPROVAL] Current user is not contract owner. Cannot approve token in contract.`);
          devLog(`[TOKEN-APPROVAL] This token needs to be approved by the contract owner: ${contractOwner}`);
          throw new Error(`Token ${tokenAddress} is not approved in the contract. Please contact the contract owner to approve this token.`);
        }
      }

      devLog(`[TOKEN-APPROVAL] Waiting for blockchain state update...`);
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

      devLog(`[TOKEN-APPROVAL] New allowance after approval: ${newAllowance}`);
      devLog(`[TOKEN-APPROVAL] New contract approval status: ${newIsTokenApproved}`);

      if (newAllowance >= amount && newIsTokenApproved) {
        devLog(`[TOKEN-APPROVAL] All approvals successful!`);
        return true;
      } else {
        throw new Error(`Approval failed. New allowance: ${newAllowance} >= ${amount} = ${newAllowance >= amount}, Contract approved: ${newIsTokenApproved}`);
      }
    } else {
      throw new Error("No external wallet available for token approval");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
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
  devLog(`[TOKEN-APPROVAL-UTIL] Approving token ${tokenAddress} in contract: ${isApproved}`);

  try {
    const currentApproval = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "approvedTokens",
      args: [tokenAddress]
    });

    devLog(`[TOKEN-APPROVAL-UTIL] Current approval status: ${currentApproval}`);

    if (currentApproval === isApproved) {
      devLog(`[TOKEN-APPROVAL-UTIL] Token already has desired approval status`);
      return true;
    }

    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "approveToken",
      args: [tokenAddress, isApproved],
    });

    devLog(`[TOKEN-APPROVAL-UTIL] Sending approval transaction...`);
    const hash = await sendTransaction(request);
    devLog(`[TOKEN-APPROVAL-UTIL] Approval transaction hash: ${hash}`);

    return hash;
  } catch (error) {
    // eslint-disable-next-line no-console
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
  devLog(`[JOIN-MATCH-DEBUG] Function called with matchId: ${matchId}, amount: ${amount}`);
  devLog(`[JOIN-MATCH] Starting joinMatch for match ${matchId} with amount ${amount}`);

  const match = await publicClient.readContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "matches",
    args: [matchId]
  }) as readonly [
    `0x${string}`,
    `0x${string}`,
    bigint,
    bigint,
    bigint,
    bigint,
    boolean,
    boolean,
    boolean,
    `0x${string}`
  ];
  devLog(`[JOIN-MATCH] Raw match data:`, match);

  const isERC20 = match[8];
  const tokenAddress = match[9];

  devLog(`[JOIN-MATCH] Match ${matchId} details:`, {
    isERC20,
    tokenAddress,
    amount: amount.toString(),
    contractAddress: contract.address
  });

  devLog(`[JOIN-MATCH] ERC20 condition check:`, {
    isERC20,
    tokenAddress,
    isERC20Condition: isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000",
    zeroAddress: "0x0000000000000000000000000000000000000000"
  });

  if (isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    devLog(`[JOIN-MATCH] This is an ERC20 match. Checking for external wallet...`);
    if (typeof window !== "undefined" && (window as any).ethereum) {
      devLog(`[JOIN-MATCH] External wallet detected. Getting wallet address...`);
      let currentWalletAddress = walletAddress;

      if (!currentWalletAddress) {
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        const signer = provider.getSigner();
        currentWalletAddress = await signer.getAddress() as `0x${string}`;
      }

      devLog(`[JOIN-MATCH] Wallet address: ${currentWalletAddress}`);

      devLog(`[JOIN-MATCH] Checking smart contract for ERC20 handler...`);
      try {
        const contractOwner = await publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "owner",
        });
        devLog(`[JOIN-MATCH] Contract owner: ${contractOwner}`);
        devLog(`[JOIN-MATCH] Contract address for ERC20 operations: ${contract.address}`);
      } catch (error) {
        devLog(`[JOIN-MATCH] Could not read contract owner:`, error);
      }

      devLog(`[JOIN-MATCH] Calling checkAndApproveToken...`);
      await checkAndApproveToken(tokenAddress, amount, contract.address, currentWalletAddress, publicClient);
      devLog(`[JOIN-MATCH] Token approval completed successfully.`);

      devLog(`[JOIN-MATCH] Waiting for blockchain state update...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      devLog(`[JOIN-MATCH] No external wallet available for ERC20 match`);
      throw new Error("External wallet required for ERC20 token matches");
    }

    devLog(`[JOIN-MATCH] Proceeding with join match transaction...`);

    if (typeof window !== "undefined" && (window as any).ethereum) {
      devLog(`[JOIN-MATCH] Using ethers.js for join match transaction...`);

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const ethersContract = new ethers.Contract(contract.address, contract.abi, signer);

      const txOptions: { value?: ethers.BigNumber } = {};
      if (!isERC20) {
        txOptions.value = ethers.BigNumber.from(amount.toString());
      }

      devLog(`[JOIN-MATCH] Sending join match transaction with ethers.js...`);
      devLog(`[JOIN-MATCH] Contract address: ${ethersContract.address}`);
      devLog(`[JOIN-MATCH] Function parameters:`, {
        matchId: matchId.toString(),
        txOptions: txOptions
      });

      const tx = await ethersContract.joinMatch(matchId.toString(), txOptions);
      devLog(`[JOIN-MATCH] Transaction sent with hash: ${tx.hash}`);

      devLog(`[JOIN-MATCH] Waiting for transaction confirmation...`);
      const receipt = await tx.wait();
      devLog(`[JOIN-MATCH] Transaction confirmed in block: ${receipt.blockNumber}`);

      return tx.hash;
    } else {
      throw new Error("No external wallet available for join match transaction");
    }
  } else {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const ethersContract = new ethers.Contract(contract.address, contract.abi, signer);
      const tx = await ethersContract.joinMatch(matchId, { value: ethers.BigNumber.from(amount.toString()) });
      return tx.hash;
    } else {
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

  devLog(`2v2 Match ${matchId} is ${isERC20 ? "an ERC20" : "an ETH"} match with token ${tokenAddress}`);

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

  devLog(`6v6 Match ${matchId} is ${isERC20 ? "an ERC20" : "an ETH"} match with token ${tokenAddress}`);

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
  // Validate amount is reasonable before proceeding
  devLog(`[DONATE-MATCH] Validating donation amount:`, {
    amountWei: amount.toString(),
    amountEth: Number(amount) / 1e18,
    maxReasonable: 1000 * 1e18 // 1000 ETH max
  });

  if (amount <= 0n) {
    throw new Error("Donation amount must be greater than 0");
  }

  if (amount > 1000n * 10n ** 18n) { // 1000 ETH max
    throw new Error("Donation amount is unreasonably high (max 1000 ETH)");
  }

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

  devLog(`[DONATE-MATCH] Match closed status check:`, {
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

  devLog(`[DONATE-MATCH] Token info:`, {
    isERC20,
    tokenAddress,
    amount: amount.toString()
  });

  // If it's an ERC20 token, check and approve token allowance
  if (isERC20 && tokenAddress) {
    devLog(`[DONATE-MATCH] ERC20 token detected. Checking approval...`);

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
    devLog(`[DONATE-MATCH] Waiting for blockchain state update...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Use ethers.js approach for ERC20 donations (same as joinMatch)
  if (isERC20 && tokenAddress) {
    devLog(`[DONATE-MATCH] Using ethers.js for ERC20 donation transaction...`);

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const contractInstance = new ethers.Contract(contract.address, contract.abi, signer);
      const tx = await contractInstance.donateToMatch(matchId, amount, { value: 0 }); // 0 ETH value for ERC20

      devLog(`[DONATE-MATCH] ERC20 donation transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      devLog(`[DONATE-MATCH] ERC20 donation confirmed in block: ${receipt.blockNumber}`);

      return receipt.transactionHash as `0x${string}`;
    } else {
      throw new Error("No wallet connected for ERC20 donation");
    }
  }

  // For ETH donations, use ethers.js approach (same as ERC20)
  devLog(`[DONATE-MATCH] Using ethers.js for ETH donation transaction...`);

  if (typeof window !== "undefined" && (window as any).ethereum) {
    const provider = new ethers.providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();

    const contractInstance = new ethers.Contract(contract.address, contract.abi, signer);
    const tx = await contractInstance.donateToMatch(matchId, amount, { value: amount }); // Full ETH value for ETH donations

    devLog(`[DONATE-MATCH] ETH donation transaction hash: ${tx.hash}`);
    const receipt = await tx.wait();
    devLog(`[DONATE-MATCH] ETH donation confirmed in block: ${receipt.blockNumber}`);

    return receipt.transactionHash as `0x${string}`;
  } else {
    throw new Error("No wallet connected for ETH donation");
  }
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
    devLog(`[CLOSE-MATCH] Function called with params:`, {
      contractAddress: contract.address,
      matchId,
      winner,
      callerAddress
    });
    // Log the caller address for debugging
    devLog(`[CLOSE-MATCH] Caller address: ${callerAddress}`);
    devLog(`[CLOSE-MATCH] Contract address: ${contract.address}`);
    devLog(`[CLOSE-MATCH] Match ID: ${matchId}`);
    devLog(`[CLOSE-MATCH] Winner: ${winner}`);

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

    devLog(`[CLOSE-MATCH] Match type check:`, {
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
      devLog(`[CLOSE-MATCH] Using closeMatch for 1v1`);
    } else if (match2v2 && (match2v2 as any)[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "close2v2Match";
      args = [matchId, winner];
      devLog(`[CLOSE-MATCH] Using close2v2Match for 2v2`);
    } else if (match6v6 && (match6v6 as any)[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "close6v6Match";
      args = [matchId, winner];
      devLog(`[CLOSE-MATCH] Using close6v6Match for 6v6`);
    } else {
      throw new Error(`No match found with ID ${matchId}`);
    }

    // Check admin status right before the transaction
    devLog(`[CLOSE-MATCH] Checking admin status before transaction...`);
    const isAdmin = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "isAdmin",
      args: [callerAddress as `0x${string}`],
    });
    devLog(`[CLOSE-MATCH] Caller ${callerAddress} is admin: ${isAdmin}`);

    // Check owner status
    const owner = await publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "owner",
    });
    devLog(`[CLOSE-MATCH] Contract owner: ${owner}`);
    devLog(`[CLOSE-MATCH] Caller is owner: ${callerAddress === owner}`);

    // Use ethers.js for external wallets, fallback to sendTransaction for embedded wallets
    if (typeof window !== "undefined" && (window as any).ethereum) {
      devLog(`[CLOSE-MATCH] Using ethers.js for external wallet`);
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

      devLog(`[CLOSE-MATCH] Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      devLog(`[CLOSE-MATCH] Transaction receipt:`, receipt);
      return tx.hash;
    } else {
      devLog(`[CLOSE-MATCH] Using sendTransaction for embedded wallet`);
      // Fallback to sendTransaction (for embedded wallets)
      const { request } = await publicClient.simulateContract({
        address: contract.address,
        abi: contract.abi,
        functionName: closeFunction as any,
        args: args as any,
        account: callerAddress as `0x${string}`,
      });
      const hash = await sendTransaction(request);
      devLog(`[CLOSE-MATCH] Transaction hash (embedded):`, hash);
      // Optionally, wait for receipt if possible
      return hash;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[CLOSE-MATCH] Error:`, error);
    throw error;
  }
}