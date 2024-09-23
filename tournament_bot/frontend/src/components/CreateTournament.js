import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { ethers } from "ethers";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Toast from "./Toast";
import { Loader2 } from "lucide-react";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const processTransactionReceipt = (receipt) => {
  console.log("Full receipt:", receipt);

  const gasUsed = ethers.utils.formatUnits(receipt.gasUsed, "wei");
  const effectiveGasPrice = ethers.utils.formatUnits(
    receipt.effectiveGasPrice,
    "gwei"
  );
  const totalGasCost = ethers.utils.formatEther(
    receipt.gasUsed.mul(receipt.effectiveGasPrice)
  );

  let tournamentId = "Unable to decode";

  try {
    if (receipt.logs && receipt.logs.length > 0) {
      const eventLog = receipt.logs[0];
      console.log("Event log topics:", eventLog.topics);

      // Decode the tournament ID from the first topic
      if (eventLog.topics.length > 1) {
        tournamentId = ethers.BigNumber.from(eventLog.topics[1]).toString();
        console.log("Tournament ID (from topics):", tournamentId);
      }
    } else {
      console.log("No logs found in the receipt");
    }
  } catch (error) {
    console.error("Error decoding tournament ID:", error);
  }

  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to,
    status: receipt.status === 1 ? "Success" : "Failure",
    gasUsed: `${gasUsed} wei`,
    effectiveGasPrice: `${effectiveGasPrice} gwei`,
    totalGasCost: `${totalGasCost} ETH`,
    eventData: {
      tournamentId: tournamentId,
    },
  };
};

const MAX_RETRIES = 10;
const RETRY_DELAY = 3000; // 3 seconds

const getReceiptWithRetry = async (provider, txHash, retries = 0) => {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      return receipt;
    } else if (retries < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return getReceiptWithRetry(provider, txHash, retries + 1);
    } else {
      throw new Error("Max retries reached. Receipt not available.");
    }
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return getReceiptWithRetry(provider, txHash, retries + 1);
    } else {
      throw error;
    }
  }
};

const CreateTournament = () => {
  const [tournamentData, setTournamentData] = useState({
    numEntrants: 0,
    winnersPercentage: 0,
    multisigPercentage: 0,
  });
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const [isCreating, setIsCreating] = useState(false);

  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const { mutate: sendTransaction } = useSendTransaction();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setTournamentData((prevState) => ({
      ...prevState,
      [name]: Number(value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsCreating(true);

    try {
      const config = prepareContractCall({
        contract,
        method: "createTournament",
        params: [
          tournamentData.numEntrants,
          tournamentData.winnersPercentage,
          tournamentData.multisigPercentage,
        ],
      });

      sendTransaction(config, {
        onSuccess: async (result) => {
          console.log("Transaction Result:", result);

          try {
            const provider = new ethers.providers.JsonRpcProvider(
              "https://sepolia.base.org"
            );
            const network = await provider.getNetwork();
            console.log("Connected to network:", network);

            console.log("Waiting for transaction receipt...");
            const receipt = await getReceiptWithRetry(
              provider,
              result.transactionHash
            );
            console.log("Transaction Receipt:", receipt);

            if (receipt) {
              const processedReceipt = processTransactionReceipt(receipt);
              console.log("Processed Transaction Receipt:", processedReceipt);

              // Post tournament info to Discord
              try {
                const discordResponse = await fetch("/api/postMatchToDiscord", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tournamentId: processedReceipt.eventData.tournamentId,
                  }),
                });

                if (!discordResponse.ok) {
                  const errorData = await discordResponse.json();
                  throw new Error(
                    errorData.error ||
                      "Failed to post tournament info to Discord"
                  );
                }

                const discordResult = await discordResponse.json();
                console.log(
                  "Tournament info posted to Discord successfully:",
                  discordResult
                );
              } catch (discordError) {
                console.error("Error posting to Discord:", discordError);
                setToast({
                  show: true,
                  message: "Tournament created, but failed to post to Discord.",
                  type: "warning",
                });
              }

              setToast({
                show: true,
                message: `Tournament created successfully! Tournament ID: ${processedReceipt.eventData.tournamentId}`,
                type: "success",
              });
            }
          } catch (receiptError) {
            console.error("Failed to fetch transaction receipt:", receiptError);
            console.log(
              "Transaction hash for manual checking:",
              result.transactionHash
            );
            setToast({
              show: true,
              message:
                "Tournament created, but failed to fetch details. Transaction hash: " +
                result.transactionHash,
              type: "warning",
            });
          }
          setIsCreating(false);
        },
        onError: (error) => {
          console.error("Transaction Error:", error);
          setToast({
            show: true,
            message: `Failed to create tournament: ${error.message}`,
            type: "error",
          });
          setIsCreating(false);
        },
      });
    } catch (error) {
      console.error("Error creating tournament:", error);
      setToast({
        show: true,
        message: "Failed to create the tournament: " + error.message,
        type: "error",
      });
      setIsCreating(false);
    }
  };

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
          disabled={isCreating}
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 flex items-center justify-center"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Tournament...
            </>
          ) : (
            "Create Tournament"
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

export default CreateTournament;
