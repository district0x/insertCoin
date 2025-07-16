import { GetContractReturnType, PublicClient } from "viem";
import { ONEVONE_ABI } from "../contracts/abis/ABI";
import { ethers } from "ethers";

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

  // If it's an ERC20 match, use the existing logic (simulate + sendTransaction)
  if (isERC20 && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "joinMatch",
      args: [matchId],
    });
    return sendTransaction(request);
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
    const [match1v1, match2v2, match5v5] = await Promise.all([
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
        functionName: "matches5v5",
        args: [matchId],
      }).catch(() => null),
    ]);

    console.log(`[CLOSE-MATCH] Match type check:`, {
      match1v1: match1v1 ? "exists" : "null",
      match2v2: match2v2 ? "exists" : "null",
      match5v5: match5v5 ? "exists" : "null"
    });

    // Determine match type and call appropriate close function
    let closeFunction: string;
    let args: any[];

    if (match1v1 && match1v1[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "closeMatch";
      args = [matchId, winner];
      console.log(`[CLOSE-MATCH] Using closeMatch for 1v1`);
    } else if (match2v2 && match2v2[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "close2v2Match";
      args = [matchId, winner];
      console.log(`[CLOSE-MATCH] Using close2v2Match for 2v2`);
    } else if (match5v5 && match5v5[0] !== '0x0000000000000000000000000000000000000000') {
      closeFunction = "close5v5Match";
      args = [matchId, winner];
      console.log(`[CLOSE-MATCH] Using close5v5Match for 5v5`);
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
