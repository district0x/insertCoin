import React, { useState } from "react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import { Loader2 } from "lucide-react";
import { ethers } from "ethers";

import Toast from "./Toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
			// const matchAmountWei = Number(ethers.utils.parseEther(matchAmountEth));

			console.log("Match Amount in Wei: ", toWei(matchAmountEth));

			const config = prepareContractCall({
				contract,
				method: "joinMatch",
				params: [Number(matchId)],
				value: toWei(matchAmountEth),
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
					setToast({
						show: true,
						message: error.message,
						type: "error",
					});
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
		<>
			<Card>
				<CardHeader>
					<CardTitle>Join a Match</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<Label htmlFor="matchId">Match ID</Label>
							<Input
								type="text"
								name="matchId"
								id="matchId"
								value={matchId}
								onChange={handleMatchIdChange}
								placeholder="Enter match ID"
								required
							/>
						</div>

						<div>
							<Label htmlFor="matchAmount">
								Match Amount (USD)
							</Label>
							<Input
								type="number"
								name="matchAmount"
								id="matchAmount"
								value={matchAmount}
								onChange={handleMatchAmountChange}
								placeholder="Enter match amount in USD"
								required
							/>
						</div>
						<Button
							type="submit"
							disabled={isLoading}
							className="w-full"
						>
							{isLoading ? (
								<span className="flex items-center justify-center">
									<Loader2 className="animate-spin mr-2 h-5 w-5" />
								</span>
							) : (
								"Join Match"
							)}
						</Button>
					</form>
					{toast.show && (
						<div className="fixed top-4 right-4 z-50 w-96">
							<Toast
								type={toast.type}
								message={toast.message}
								onClose={() =>
									setToast({
										show: false,
										message: "",
										type: "success",
									})
								}
							/>
						</div>
					)}
				</CardContent>
			</Card>
		</>
	);
};

export default JoinMatch;
