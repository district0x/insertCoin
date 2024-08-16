import React, { useState, useCallback, useMemo } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction, useContractEvents } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Toast from "./Toast";
import { ethers } from "ethers";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const DISCORD_CHANNEL_ID = "1255046820720021547";
const MAX_RETRIES = 30; // Maximum number of retries (30 seconds)

// Helper function to safely stringify objects with BigInt values
const safeStringify = (obj) => {
  return JSON.stringify(obj, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
};

const CloseMatch = () => {
  console.log("CloseMatch component rendered");
  const [matchId, setMatchId] = useState("");
  const [winnerAddress, setWinnerAddress] = useState("");
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const contract = useMemo(() => {
    console.log("Creating contract instance");
    return getContract({
      client,
      chain: chainl,
      address: contractAddress,
      abi: ABI,
    });
  }, [client, chainl, contractAddress]);

  const { mutate: sendTransaction } = useSendTransaction();

  const { data: events, refetch: refetchEvents } = useContractEvents({
    contract,
    eventName: "MatchClosed",
  });

  const fetchLatestEvent = useCallback(
    async (matchIdToFind) => {
      console.log("Fetching latest event for match ID:", matchIdToFind);
      await refetchEvents();
      console.log("All events after refetch:", safeStringify(events));
      const foundEvent = events?.find(
        (event) =>
          event.eventName === "MatchClosed" &&
          event.args?.matchId?.toString() === matchIdToFind
      );
      console.log("Found event:", safeStringify(foundEvent));
      return foundEvent;
    },
    [events, refetchEvents]
  );

  const retryFetchEvent = useCallback(
    async (matchIdToFind, retryCount = 0) => {
      console.log(
        `Attempt ${
          retryCount + 1
        } to fetch event for match ID: ${matchIdToFind}`
      );
      const event = await fetchLatestEvent(matchIdToFind);
      if (event) {
        console.log("Event found. Full event data:", safeStringify(event));
        console.log("Event args:", safeStringify(event.args));
        console.log("Match ID from event:", event.args.matchId.toString());
        return event;
      } else if (retryCount < MAX_RETRIES) {
        console.log(`Event not found. Retrying in 1 second...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
        return retryFetchEvent(matchIdToFind, retryCount + 1);
      } else {
        console.log(
          `Max retries reached. Event not found for match ID: ${matchIdToFind}`
        );
        return null;
      }
    },
    [fetchLatestEvent]
  );

  const sendToDiscord = useCallback(async (data) => {
    console.log("Preparing to send data to Discord:", safeStringify(data));
    const content = `
      🎮 Match Closed! 🎮
      Match ID: ${data.matchId}
      Winner: ${data.winner}
      Winner Amount: ${data.winnerAmount} ETH
      Multisig Amount: ${data.multisigAmount} ETH
      Pool Amount: ${data.poolAmount} ETH
    `;
    console.log("Discord message content:", content);

    try {
      console.log("Sending POST request to /api/sendMessage");
      const response = await fetch("/api/sendMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId: DISCORD_CHANNEL_ID,
          content: content,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message to Discord");
      }

      console.log("Message sent to Discord successfully");
    } catch (error) {
      console.error("Error sending message to Discord:", error);
      setToast({
        show: true,
        message: "Failed to send Discord notification",
        type: "error",
      });
    }
  }, []);

  const handleMatchIdChange = useCallback((event) => {
    console.log("Match ID changed:", event.target.value);
    setMatchId(event.target.value);
  }, []);

  const handleWinnerAddressChange = useCallback((event) => {
    console.log("Winner address changed:", event.target.value);
    setWinnerAddress(event.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      console.log(
        "Form submitted. Match ID:",
        matchId,
        "Winner Address:",
        winnerAddress
      );

      try {
        const config = prepareContractCall({
          contract,
          method: "closeMatch",
          params: [matchId, winnerAddress],
        });
        console.log("Contract call prepared:", safeStringify(config));

        sendTransaction(config, {
          onSuccess: async (result) => {
            console.log(
              "Transaction successful. Result:",
              safeStringify(result)
            );
            setToast({
              show: true,
              message: "Match closed successfully!",
              type: "success",
            });

            console.log("Starting to fetch the latest event");
            const latestMatchEvent = await retryFetchEvent(matchId);

            if (latestMatchEvent) {
              console.log(
                "Latest match event found:",
                safeStringify(latestMatchEvent)
              );
              const {
                matchId,
                winner,
                winnerAmount,
                multisigAmount,
                poolAmount,
              } = latestMatchEvent.args;

              const formattedData = {
                matchId: matchId.toString(),
                winner,
                winnerAmount: ethers.utils.formatEther(winnerAmount),
                multisigAmount: ethers.utils.formatEther(multisigAmount),
                poolAmount: ethers.utils.formatEther(poolAmount),
              };
              console.log(
                "Formatted event data:",
                safeStringify(formattedData)
              );

              await sendToDiscord(formattedData);
            } else {
              console.log(
                "No matching event found for the closed match after retries"
              );
              setToast({
                show: true,
                message:
                  "Failed to find match closing event. Discord notification not sent.",
                type: "error",
              });
            }
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            let errorMessage = "Transaction failed";
            if (error.message) {
              errorMessage += `: ${error.message}`;
            }
            if (error.details) {
              errorMessage += ` Details: ${error.details}`;
            }
            setToast({ show: true, message: errorMessage, type: "error" });
          },
        });
      } catch (error) {
        console.error("Error preparing transaction:", error);
        setToast({
          show: true,
          message: `Error preparing transaction: ${error.message}`,
          type: "error",
        });
      }
    },
    [
      contract,
      matchId,
      winnerAddress,
      sendTransaction,
      retryFetchEvent,
      sendToDiscord,
    ]
  );

  console.log("Rendering CloseMatch component");
  return (
    <div className="w-full max-w-md p-6 bg-white border border-gray-200 rounded-lg shadow-md sm:p-8 dark:bg-gray-800 dark:border-gray-700 mx-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        Close a Match
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
            htmlFor="winnerAddress"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Winner Address
          </label>
          <input
            type="text"
            name="winnerAddress"
            id="winnerAddress"
            value={winnerAddress}
            onChange={handleWinnerAddressChange}
            placeholder="Enter winner's address"
            required
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          Close Match
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

export default React.memo(CloseMatch);
