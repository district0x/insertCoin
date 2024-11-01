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
			const response = await fetch("/api/eth-price");
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch ETH price");
			}

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
				console.log("ethPrice", ethPrice);
				const amountInWei = BigInt(matchingPoolData).toString();
				console.log("amountInWei", amountInWei);
				const amountInEth = parseFloat(
					ethers.utils.formatEther(amountInWei)
				);
				console.log("amountInEth", amountInEth);
				const usdValue = (amountInEth * ethPrice).toFixed(2);
				console.log("usdValue", usdValue);
				setMatchingPoolUsd(usdValue);
			}
		};

		updateMatchingPoolUsd();
	}, [matchingPoolData, isContractLoading]);

	if (matchingPoolUsd === null) {
		return null; // or return a loading indicator if you prefer
	}

	return (
		// <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
		//   Matching Pool: ${matchingPoolUsd}
		// </div>
		<div className="text-2xl font-bold mb-8">
			Matching Pool:{" "}
			<span className="text-yellow-400">${matchingPoolUsd}</span>
		</div>
	);
};

export default MatchingPoolDisplay;
