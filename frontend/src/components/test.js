import React from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { client, chain as chainl } from "../app/client"; // Adjust the import according to your setup
import ABI from "../lib/contractABI.json"; // Import the ABI from your contract
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS; // Ensure your contract address is in your environment variables

const NextMatchId = () => {
  // Create a contract instance
  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  // Fetch the next match ID using the 'nextMatchId' method from the smart contract
  const {
    data: nextMatchId,
    isLoading,
    error,
  } = useReadContract({
    contract,
    method: "nextMatchId",
    params: [],
  });

  console.log("Next Match ID:", nextMatchId);

  // Handle loading state
  if (isLoading) {
    return <p>Loading...</p>;
  }

  // Handle possible errors
  if (error) {
    console.error("Failed to load the next match ID:", error);
    return <p>Error loading the next match ID. Please try again later.</p>;
  }

  // Display the next match ID
  return (
    <div>
      <h1>Next Match ID</h1>
      <p>{Number(nextMatchId)}</p>
    </div>
  );
};

export default NextMatchId;
