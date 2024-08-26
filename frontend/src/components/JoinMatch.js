import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Toast from "./Toast";
import { Loader2 } from "lucide-react";
import { ethers } from "ethers";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const JoinMatch = () => {
  const [matchId, setMatchId] = useState("");
  const [matchAmount, setMatchAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
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

  const { mutate: sendTransaction } = useSendTransaction();

  const handleMatchIdChange = (event) => setMatchId(event.target.value);
  const handleMatchAmountChange = (event) =>
    setMatchAmount(Number(event.target.value));

  const getMatchAmountInEth = async (matchAmountUsd) => {
    try {
      const response = await fetch("/api/eth-price");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch ETH price");
      }

      const ethPriceInUsd = data.ethereum.usd;
      const matchAmountEth = (matchAmountUsd / ethPriceInUsd).toFixed(18);
      return matchAmountEth;
    } catch (error) {
      console.error("Error fetching ETH price:", error);
      throw error;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const matchAmountEth = await getMatchAmountInEth(matchAmount);
      const matchAmountWei = Number(ethers.utils.parseEther(matchAmountEth));

      console.log("Match Amount in Wei: ", matchAmountWei);

      const config = prepareContractCall({
        contract,
        method: "joinMatch",
        params: [Number(matchId)],
        value: Number(matchAmountWei),
      });

      sendTransaction(config, {
        onSuccess: () => {
          setToast({
            show: true,
            message: "Match joined successfully!",
            type: "success",
          });
          setIsLoading(false);
        },
        onError: (error) => {
          setToast({ show: true, message: error.message, type: "error" });
          setIsLoading(false);
        },
      });
    } catch (error) {
      setToast({
        show: true,
        message: "Failed to convert USD to ETH.",
        type: "error",
      });
      console.error("Conversion error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white border border-gray-200 rounded-lg shadow-md sm:p-8 dark:bg-gray-800 dark:border-gray-700 mx-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        Join a Match
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="matchId"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Match ID
          </label>
          <input
            type="text"
            name="matchId"
            id="matchId"
            value={matchId}
            onChange={handleMatchIdChange}
            placeholder="Enter match ID"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="matchAmount"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Match Amount (USD)
          </label>
          <input
            type="number"
            name="matchAmount"
            id="matchAmount"
            value={matchAmount}
            onChange={handleMatchAmountChange}
            placeholder="Enter match amount in USD"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-2 h-5 w-5" />
            </span>
          ) : (
            "Join Match"
          )}
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

export default JoinMatch;
