import { GetContractReturnType, PublicClient, WalletClient } from "viem";
import { ONEVONE_ABI } from "../contracts/abis/ABI";
import { ERC20_APPROVAL_ABI } from "../constants/tokens";

// Helper function to check if a match uses ERC20 tokens and approve if needed
async function checkAndApproveERC20(
  publicClient: PublicClient,
  walletClient: WalletClient,
  matchId: bigint,
  tokenAddress: `0x${string}`,
  contractAddress: `0x${string}`,
  amount: bigint
) {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  // Check allowance first
  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_APPROVAL_ABI,
    functionName: "allowance",
    args: [walletClient.account.address, contractAddress]
  });

  if (allowance >= amount) {
    console.log(`Sufficient allowance (${allowance} >= ${amount}) for token ${tokenAddress}`);
    return true;
  }

  console.log(`Approving ${amount} tokens at address ${tokenAddress} for contract ${contractAddress}`);
  
  // Need to approve tokens
  const { request } = await publicClient.simulateContract({
    address: tokenAddress,
    abi: ERC20_APPROVAL_ABI,
    functionName: "approve",
    args: [contractAddress, amount],
    account: walletClient.account.address
  });

  const hash = await walletClient.writeContract(request);
  
  // Wait for approval transaction to complete
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash,
    timeout: 60000
  });
  
  if (receipt.status !== "success") {
    throw new Error("Token approval failed");
  }
  
  return true;
}

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

  // Get match details to check if it uses ERC20 tokens
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
    boolean, // isERC20
    `0x${string}` // token
  ];

  const isERC20 = match[7];
  const tokenAddress = match[8];
  
  console.log(`Match ${matchId} is ${isERC20 ? "an ERC20" : "an ETH"} match with token ${tokenAddress}`);

  // If it's an ERC20 match, approve tokens first
  if (isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    await checkAndApproveERC20(
      publicClient,
      walletClient,
      matchId,
      tokenAddress,
      contract.address,
      amount
    );
    
    // For ERC20 matches, send without ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "joinMatch",
      args: [matchId],
      account: walletClient.account.address,
    });

    return walletClient.writeContract(request);
  } else {
    // For ETH matches, include the ETH value
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
    await checkAndApproveERC20(
      publicClient,
      walletClient,
      matchId,
      tokenAddress,
      contract.address,
      amount
    );
    
    // For ERC20 matches, send without ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join2v2Team",
      args: [matchId, isTeamA],
      account: walletClient.account.address,
    });

    return walletClient.writeContract(request);
  } else {
    // For ETH matches, include the ETH value
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

  // Get match details to check if it uses ERC20 tokens
  const match5v5 = await publicClient.readContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "matches5v5",
    args: [matchId],
  }) as readonly [
    `0x${string}`, // player1
    `0x${string}`, // player2
    `0x${string}`, // teamAPlayer2
    `0x${string}`, // teamAPlayer3
    `0x${string}`, // teamAPlayer4
    `0x${string}`, // teamAPlayer5
    `0x${string}`, // teamBPlayer2
    `0x${string}`, // teamBPlayer3
    `0x${string}`, // teamBPlayer4
    `0x${string}`, // teamBPlayer5
    bigint, // player1Amount
    bigint, // totalAmount
    `0x${string}`, // token
    boolean, // isERC20
    boolean // isOpen
  ];
  
  if (!match5v5) {
    throw new Error("Match not found");
  }

  const isERC20 = match5v5[13];
  const tokenAddress = match5v5[12];
  
  console.log(`5v5 Match ${matchId} is ${isERC20 ? "an ERC20" : "an ETH"} match with token ${tokenAddress}`);

  // If it's an ERC20 match, approve tokens first
  if (isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    await checkAndApproveERC20(
      publicClient,
      walletClient,
      matchId,
      tokenAddress,
      contract.address,
      amount
    );
    
    // For ERC20 matches, send without ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join5v5Team",
      args: [matchId, isTeamA],
      account: walletClient.account.address,
    });

    return walletClient.writeContract(request);
  } else {
    // For ETH matches, include the ETH value
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

  // Check match state in all match types to determine if it's open
  const [match1v1, match2v2, match5v5] = await Promise.all([
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
    // Check 5v5 match
    publicClient.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "matches5v5",
      args: [matchId],
    }) as Promise<
      readonly [
        `0x${string}`, // player1
        `0x${string}`, // player2
        `0x${string}`, // teamAPlayer2
        `0x${string}`, // teamAPlayer3
        `0x${string}`, // teamAPlayer4
        `0x${string}`, // teamAPlayer5
        `0x${string}`, // teamBPlayer2
        `0x${string}`, // teamBPlayer3
        `0x${string}`, // teamBPlayer4
        `0x${string}`, // teamBPlayer5
        bigint, // player1Amount
        bigint, // totalAmount
        `0x${string}`, // token
        boolean, // isERC20
        boolean // isOpen
      ]
    >,
  ]);

  // Check if any of the match types are open
  const isMatchOpen = match1v1[6] || match2v2[8] || match5v5[14];

  if (!isMatchOpen) {
    throw new Error("This match is closed and no longer accepting donations");
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
