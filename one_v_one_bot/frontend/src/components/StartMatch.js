import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { ethers } from 'ethers';
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Toast from "./Toast";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const processTransactionReceipt = (receipt) => {
  const gasUsed = ethers.utils.formatUnits(receipt.gasUsed, 'wei');
  const effectiveGasPrice = ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei');
  const totalGasCost = ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice));

  const eventLog = receipt.logs[0];
  const eventData = ethers.utils.defaultAbiCoder.decode(
    ['uint256', 'address', 'uint256'],
    eventLog.data
  );

  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to,
    status: receipt.status === 1 ? 'Success' : 'Failure',
    gasUsed: `${gasUsed} wei`,
    effectiveGasPrice: `${effectiveGasPrice} gwei`,
    totalGasCost: `${totalGasCost} ETH`,
    eventData: {
      matchId: eventData[0].toString(),
      player: eventData[1],
      amount: ethers.utils.formatEther(eventData[2]) + ' ETH'
    }
  };
};

const StartMatch = () => {
  const [matchAmount, setMatchAmount] = useState("");
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
    const cleanedValue = event.target.value.trim();
    setMatchAmount(cleanedValue);
  };

  const getEthPriceInUsd = async () => {
    try {
      const response = await fetch("/api/eth-price");
      const data = await response.json();
      return data.ethereum.usd;
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
      throw error;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = parseFloat(matchAmount);
  
    if (isNaN(amount) || amount <= 0) {
      setToast({
        show: true,
        message: "Invalid match amount. Please enter a valid number.",
        type: "error",
      });
      return;
    }
  
    try {
      const ethPriceInUsd = await getEthPriceInUsd();
      const matchAmountEth = (amount / ethPriceInUsd).toFixed(18);
      const matchAmountWei = ethers.utils.parseEther(matchAmountEth).toString();
  
      console.log("Match Amount in Wei: ", matchAmountWei);
  
      const config = prepareContractCall({
        contract,
        method: "startMatch",
        params: [matchAmountWei],
        value: matchAmountWei,
      });
  
      sendTransaction(config, {
        onSuccess: async (result) => {
          console.log("Transaction Result:", result);
          
          try {
            const provider = new ethers.providers.JsonRpcProvider("https://sepolia.base.org");            
            const network = await provider.getNetwork();
            console.log("Connected to network:", network);
  
            const receipt = await provider.getTransactionReceipt(result.transactionHash);
            console.log("Transaction Receipt:", receipt);
  
            if (receipt) {
              const processedReceipt = processTransactionReceipt(receipt);
              console.log("Processed Transaction Receipt:", processedReceipt);
              
              // Post match info to Discord
              try {
                const discordResponse = await fetch('/api/postMatchToDiscord', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ matchId: processedReceipt.eventData.matchId }),
                });
  
                if (!discordResponse.ok) {
                  const errorData = await discordResponse.json();
                  throw new Error(errorData.error || "Failed to post match info to Discord");
                }
  
                const discordResult = await discordResponse.json();
                console.log("Match info posted to Discord successfully:", discordResult);
              } catch (discordError) {
                console.error("Error posting to Discord:", discordError);
                // You might want to set a toast here to inform the user
              }
  
              setToast({
                show: true,
                message: `Match started successfully! Match ID: ${processedReceipt.eventData.matchId}`,
                type: "success",
              });
            } else {
              console.log("Receipt not available immediately. It might take a few moments.");
              setToast({
                show: true,
                message: "Match started. Waiting for confirmation...",
                type: "success",
              });
            }
          } catch (receiptError) {
            console.error("Failed to fetch transaction receipt:", receiptError);
            console.log("Transaction hash for manual checking:", result.transactionHash);
            setToast({
              show: true,
              message: "Match started, but failed to fetch details. Transaction hash: " + result.transactionHash,
              type: "warning",
            });
          }
        },
        onError: (error) => {
          console.error("Transaction Error:", error);
          setToast({ 
            show: true, 
            message: `Failed to start match: ${error.message}`, 
            type: "error" 
          });
        },
      });

      
    } catch (error) {
      console.error("Error starting match:", error);
      setToast({
        show: true,
        message: "Failed to start the match: " + error.message,
        type: "error",
      });
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white border border-gray-200 rounded-lg shadow-md sm:p-8 dark:bg-gray-800 dark:border-gray-700 mx-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        Start a New Match
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
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
            onChange={handleChange}
            placeholder="Enter match amount in USD"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-50"
        >
          {isLoading ? "Starting Match..." : "Start Match"}
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

export default StartMatch;
