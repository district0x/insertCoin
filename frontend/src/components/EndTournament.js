import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client"; // Ensure correct import names
import ABI from "../lib/contractABI.json"; // Import the ABI from your contract

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS; // Your contract address here

const EndTournament = () => {
  const [endTournamentData, setEndTournamentData] = useState({
    tournamentId: "",
    winners: "",
    winnersPercentages: "",
  });

  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const {
    mutate: sendTransaction,
    isLoading,
    isSuccess,
    error,
  } = useSendTransaction();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEndTournamentData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const winnersArray = endTournamentData.winners.split(",");
    const winnersPercentagesArray = endTournamentData.winnersPercentages
      .split(",")
      .map(Number);

    // Prepare the contract call
    const config = prepareContractCall({
      contract,
      method: "endTournament",
      params: [
        parseInt(endTournamentData.tournamentId),
        winnersArray,
        winnersPercentagesArray,
      ],
    });

    sendTransaction(config);
  };

  if (isLoading) {
    return <p>Transaction in progress...</p>;
  }

  if (error) {
    console.error("Failed to end tournament:", error);
    return <p>An error occurred: {error.message}</p>;
  }

  if (isSuccess) {
    alert("Tournament ended successfully!");
  }

  return (
    <div className="container max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        End a Tournament
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <label
          htmlFor="tournamentId"
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          Tournament ID
        </label>
        <input
          type="text"
          id="tournamentId"
          name="tournamentId"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          value={endTournamentData.tournamentId}
          onChange={handleChange}
          placeholder="Enter Tournament ID"
          required
        />
        <label
          htmlFor="winners"
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          Winners (comma-separated addresses)
        </label>
        <input
          type="text"
          id="winners"
          name="winners"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          value={endTournamentData.winners}
          onChange={handleChange}
          placeholder="Enter Winner Addresses"
          required
        />
        <label
          htmlFor="winnersPercentages"
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          Winners Percentages (comma-separated)
        </label>
        <input
          type="text"
          id="winnersPercentages"
          name="winnersPercentages"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          value={endTournamentData.winnersPercentages}
          onChange={handleChange}
          placeholder="Enter Percentage for Each Winner"
          required
        />
        <button
          type="submit"
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue

-700 dark:focus:ring-blue-800"
        >
          End Tournament
        </button>
      </form>
    </div>
  );
};

export default EndTournament;
