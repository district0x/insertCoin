import React, { useState, useEffect, useCallback } from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { ethers } from "ethers";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Spinner from "./Spinner";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const CurrentMatches = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [ethPriceInUsd, setEthPriceInUsd] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(true);

  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const {
    data: matchData,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    contract,
    method: "matches",
    params: [index],
  });

  const fetchEthPrice = async () => {
    try {
      const response = await fetch("/api/eth-price");
      const data = await response.json();
      const price = data.ethereum.usd;
      setEthPriceInUsd(price);
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
    }
  };

  useEffect(() => {
    fetchEthPrice();
  }, []);

  const processMatchData = useCallback((data, idx) => {
    return {
      player1: data[0],
      player2: data[1],
      player1Amount: data[2],
      player2Amount: data[3],
      donatedAmount: data[5],
      totalAmount: data[4],
      isOpen: data[6],
    };
  }, []);

  useEffect(() => {
    const fetchMatch = async () => {
      if (!isLoading && matchData && !error && hasMoreMatches) {
        if (matchData[0] === "0x0000000000000000000000000000000000000000") {
          setHasMoreMatches(false);
          setLoading(false);
          return;
        }

        const newMatch = processMatchData(matchData, index);
        setMatches(prevMatches => [...prevMatches, newMatch]);
        setIndex(prevIndex => prevIndex + 1);
        refetch();
      } else if (error || !hasMoreMatches) {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [matchData, isLoading, error, refetch, index, hasMoreMatches, processMatchData]);

  const weiToUsd = useCallback((wei) => {
    const eth = ethers.utils.formatEther(wei);
    return (parseFloat(eth) * ethPriceInUsd).toFixed(2);
  }, [ethPriceInUsd]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-5xl font-bold mb-4 text-grey-600 text-center">
        Current Matches
      </h1>
      {loading && matches.length === 0 && (
        <p>
          <Spinner className="text-center mt-4 w-screen m-auto" />
        </p>
      )}
      {matches.length === 0 && !loading && <p>No matches found.</p>}
      {matches.length > 0 && (
        <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
          <table className="w-full text-sm text-left text-blue-100 dark:text-blue-100">
            <thead className="text-xs text-white uppercase bg-blue-600 border-b border-blue-400 dark:text-white">
              <tr>
                <th scope="col" className="px-6 py-3 bg-blue-500">
                  Match ID
                </th>
                {Object.keys(matches[0]).map((key, index) => (
                  <th key={index} scope="col" className="px-6 py-3 bg-blue-500">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((match, idx) => (
                <tr key={idx} className="bg-blue-600 border-b border-blue-400">
                  <td className="px-6 py-4 font-medium text-blue-50 whitespace-nowrap bg-blue-500">
                    {idx}
                  </td>
                  {Object.entries(match).map(([key, value], index) => (
                    <td
                      key={index}
                      className="px-6 py-4 bg-blue-500 text-blue-50"
                    >
                      {key.includes("Amount")
                        ? `$${weiToUsd(value)}`
                        : value.toString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading && matches.length > 0 && (
        <p className="text-center mt-4">
          <Spinner /> Loading more matches...
        </p>
      )}
    </div>
  );
};

export default CurrentMatches;
