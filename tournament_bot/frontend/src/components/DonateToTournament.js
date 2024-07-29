import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { ethers } from "ethers";
import Toast from "./Toast"; // Assuming Toast is in the same directory

import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const DonateToTournament = () => {
  const [donationData, setDonationData] = useState({
    tournamentId: "",
    amounts: "",
  });
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setDonationData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const getEthPriceInUsd = async () => {
    try {
      const response = await fetch("/api/eth-price");
      const data = await response.json();
      console.log("ETH Price in USD:", data.ethereum.usd);
      return data.ethereum.usd;
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
      throw new Error("Failed to fetch ETH price");
    }
  };

  const convertUsdToWei = async (usdAmount) => {
    const ethPriceInUsd = await getEthPriceInUsd();
    const ethAmount = usdAmount / ethPriceInUsd;
    const weiAmount = ethers.utils.parseUnits(ethAmount.toFixed(18), "ether");
    console.log(
      `USD Amount: ${usdAmount} => ETH Amount: ${ethAmount} => Wei Amount: ${weiAmount.toString()}`,
    );
    return weiAmount;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const amountsArray = donationData.amounts
        .split(",")
        .map((amount) => parseFloat(amount.trim()));

      console.log("Amounts Array in USD:", amountsArray);

      const amountsArrayInWei = await Promise.all(
        amountsArray.map((amount) => convertUsdToWei(amount)),
      );

      console.log("Amounts Array in Wei:", amountsArrayInWei);

      const totalAmountInWei = amountsArrayInWei.reduce(
        (a, b) => a.add(b),
        ethers.BigNumber.from(0),
      );

      console.log("Total Amount in Wei:", totalAmountInWei.toString());
      console.log(amountsArrayInWei.map((amount) => Number(amount)));

      const config = prepareContractCall({
        contract,
        method: "donate",
        params: [
          amountsArrayInWei.map((amount) => Number(amount)),
          parseInt(donationData.tournamentId),
        ],
        value: Number(totalAmountInWei),
      });

      console.log("Contract Call Configuration:", config);

      sendTransaction(config, {
        onSuccess: () => {
          console.log("Donation successful!");
          setToast({
            show: true,
            message: "Donation made successfully!",
            type: "success",
          });
        },
        onError: (error) => {
          console.error("Failed to donate to tournament:", error);
          setToast({
            show: true,
            message: `An error occurred: ${error.message}`,
            type: "error",
          });
        },
      });
    } catch (error) {
      console.error("Conversion error:", error);
      setToast({
        show: true,
        message: `An error occurred during conversion: ${error.message}`,
        type: "error",
      });
    }
  };

  return (
    <div className="container max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="text-xl font-bold mb-6 text-white">
        Donate to a Tournament
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <label
          htmlFor="tournamentId"
          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          Tournament ID
        </label>
        <input
          type="text"
          name="tournamentId"
          id="tournamentId"
          value={donationData.tournamentId}
          onChange={handleChange}
          placeholder="Enter Tournament ID"
          required
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
        />
        <label
          htmlFor="amounts"
          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          Amounts to Donate (comma-separated, in USD)
        </label>
        <input
          type="text"
          name="amounts"
          id="amounts"
          value={donationData.amounts}
          onChange={handleChange}
          placeholder="Enter Amounts to Donate (comma-separated, in USD)"
          required
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
        />
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

export default DonateToTournament;
