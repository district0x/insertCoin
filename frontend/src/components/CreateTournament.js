import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client"; // Ensure correct import names
import ABI from "../lib/contractABI.json"; // Import the ABI from your contract

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS; // Your contract address here

const CreateTournament = () => {
  const [tournamentData, setTournamentData] = useState({
    numEntrants: 0,
    winnersPercentage: 0,
    multisigPercentage: 0,
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
    setTournamentData((prevState) => ({
      ...prevState,
      [name]: Number(value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const config = prepareContractCall({
      contract,
      method: "createTournament",
      params: [
        tournamentData.numEntrants,
        tournamentData.winnersPercentage,
        tournamentData.multisigPercentage,
      ],
    });
    sendTransaction(config);
  };

  if (isLoading) {
    return <p>Transaction in progress...</p>;
  }

  if (error) {
    console.error("Failed to create tournament:", error);
    return <p>An error occurred: {error.message}</p>;
  }

  if (isSuccess) {
    alert("Tournament created successfully!");
  }

  return (
    <div className="w-full max-w-md p-6 bg-white border border-gray-200 rounded-lg shadow-md sm:p-8 dark:bg-gray-800 dark:border-gray-700 mx-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        Create a New Tournament
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="numEntrants"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Number of Entrants
          </label>
          <input
            type="number"
            name="numEntrants"
            id="numEntrants"
            value={tournamentData.numEntrants}
            onChange={handleChange}
            placeholder="Number of Entrants"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="winnersPercentage"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Winners Percentage
          </label>
          <input
            type="number"
            name="winnersPercentage"
            id="winnersPercentage"
            value={tournamentData.winnersPercentage}
            onChange={handleChange}
            placeholder="Winners Percentage"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="multisigPercentage"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Multisig Wallet Percentage
          </label>
          <input
            type="number"
            name="multisigPercentage"
            id="multisigPercentage"
            value={tournamentData.multisigPercentage}
            onChange={handleChange}
            placeholder="Multisig Wallet Percentage"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center

 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          Create Tournament
        </button>
      </form>
    </div>
  );
};

export default CreateTournament;
