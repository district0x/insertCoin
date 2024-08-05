import React, { useState, useEffect } from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { ethers } from "ethers";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const MatchingPoolDisplay = () => {
  const [matchingPoolUsd, setMatchingPoolUsd] = useState(null);

  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const { data: matchingPoolData, isLoading: isContractLoading } =
    useReadContract({
      contract,
      method: "matchingPool",
    });

  const fetchEthPrice = async () => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const data = await response.json();
      return data.ethereum.usd;
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
      return 0;
    }
  };

  useEffect(() => {
    const updateMatchingPoolUsd = async () => {
      if (!isContractLoading && matchingPoolData !== undefined) {
        const ethPrice = await fetchEthPrice();
        const amountInWei = BigInt(matchingPoolData).toString();
        const amountInEth = parseFloat(ethers.utils.formatEther(amountInWei));
        const usdValue = (amountInEth * ethPrice).toFixed(2);
        setMatchingPoolUsd(usdValue);
      }
    };

    updateMatchingPoolUsd();
  }, [matchingPoolData, isContractLoading]);

  if (matchingPoolUsd === null) {
    return null; // or return a loading indicator if you prefer
  }

  return (
    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
      Matching Pool: ${matchingPoolUsd}
    </div>
  );
};

export default MatchingPoolDisplay;
