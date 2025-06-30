import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../contracts/abis/ABI";

// Type for Privy's sendTransaction function - using a more specific type
type SendTransactionFunction = (request: {
  address: `0x${string}`;
  abi: unknown;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}) => Promise<`0x${string}`>;

export async function joinMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  amount: bigint
) {
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
    // For ERC20 matches, we need the user's address - this will be handled by the calling component
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "joinMatch",
      args: [matchId],
    });

    return sendTransaction(request);
  } else {
    // For ETH matches, include the ETH value
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

export async function join5v5Team(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  isTeamA: boolean,
  amount: bigint
) {
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
    // For ERC20 matches, send without ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join5v5Team",
      args: [matchId, isTeamA],
    });

    return sendTransaction(request);
  } else {
    // For ETH matches, include the ETH value
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "join5v5Team",
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
  });

  return sendTransaction(request);
}

export async function closeMatch(
  contract: GetContractReturnType<typeof ONEVONE_ABI>,
  publicClient: PublicClient,
  sendTransaction: SendTransactionFunction,
  matchId: bigint,
  winner: `0x${string}`
) {
  const { request } = await publicClient.simulateContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "closeMatch",
    args: [matchId, winner],
  });

  return sendTransaction(request);
}
