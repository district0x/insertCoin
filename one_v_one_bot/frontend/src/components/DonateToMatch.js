import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Toast from "./Toast";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const DonateToMatch = () => {
  const [donationAmount, setDonationAmount] = useState(0);
  const [matchId, setMatchId] = useState("");
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

  const handleDonationAmountChange = (event) =>
    setDonationAmount(Number(event.target.value));
  const handleMatchIdChange = (event) => setMatchId(event.target.value);

  const getMatchAmountInEth = async (matchAmountUsd) => {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    );
    const data = await response.json();
    const ethPriceInUsd = data.ethereum.usd;
    const matchAmountEth = (matchAmountUsd / ethPriceInUsd).toFixed(18);
    return matchAmountEth;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const donationAmountEth = await getMatchAmountInEth(donationAmount);
      const donationAmountWei = (donationAmountEth * 1e18).toString(); // Convert ETH to Wei

      console.log("Donation Amount in Wei: ", donationAmountWei);

      const config = prepareContractCall({
        contract,
        method: "donateToMatch",
        params: [matchId, donationAmountWei],
        value: donationAmountWei, // Ensure to pass the value for the payable function
      });

      sendTransaction(config, {
        onSuccess: () =>
          setToast({
            show: true,
            message: "Donation successful!",
            type: "success",
          }),
        onError: (error) =>
          setToast({ show: true, message: error.message, type: "error" }),
      });
    } catch (error) {
      setToast({
        show: true,
        message: "Failed to convert USD to ETH.",
        type: "error",
      });
      console.error("Conversion error:", error);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white border border-gray-200 rounded-lg shadow-md sm:p-8 dark:bg-gray-800 dark:border-gray-700 mx-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        Donate to a Match
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
            htmlFor="donationAmount"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Donation Amount (USD)
          </label>
          <input
            type="number"
            name="donationAmount"
            id="donationAmount"
            value={donationAmount}
            onChange={handleDonationAmountChange}
            placeholder="Enter donation amount in USD"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          Donate
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

export default DonateToMatch;
