import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Toast from "./Toast";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const ClaimReward = () => {
  const [tournamentId, setTournamentId] = useState("");
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const { mutate: sendTransaction, isLoading } = useSendTransaction();

  const handleTournamentIdChange = (event) =>
    setTournamentId(event.target.value);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const config = prepareContractCall({
      contract,
      method: "claimReward",
      params: [tournamentId],
    });

    sendTransaction(config, {
      onSuccess: () =>
        setToast({
          show: true,
          message: "Reward claimed successfully!",
          type: "success",
        }),
      onError: (error) =>
        setToast({ show: true, message: error.message, type: "error" }),
    });
  };

  return (
    <div className="w-full max-w-md p-6 bg-white border border-gray-200 rounded-lg shadow-md sm:p-8 dark:bg-gray-800 dark:border-gray-700 mx-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        Claim Reward
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="tournamentId"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Tournament ID
          </label>
          <input
            type="text"
            name="tournamentId"
            id="tournamentId"
            value={tournamentId}
            onChange={handleTournamentIdChange}
            placeholder="Enter tournament ID"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          Claim Reward
        </button>
      </form>
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 w-96">
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() =>
              setToast({ show: false, message: "", type: "success" })
            }
          />
        </div>
      )}
    </div>
  );
};

export default ClaimReward;
