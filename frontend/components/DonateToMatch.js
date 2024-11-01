import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import { Loader2 } from "lucide-react";

import Toast from "./Toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const DonateToMatch = () => {
	const [donationAmount, setDonationAmount] = useState(0);
	const [matchId, setMatchId] = useState("");
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

	const handleDonationAmountChange = (event) =>
		setDonationAmount(Number(event.target.value));
	const handleMatchIdChange = (event) => setMatchId(event.target.value);

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
			const donationAmountEth = await getMatchAmountInEth(donationAmount);
			const donationAmountWei = Number(donationAmountEth * 1e18); // Convert ETH to Wei

			console.log("Donation Amount in Wei: ", donationAmountWei);

			const config = prepareContractCall({
				contract,
				method: "donateToMatch",
				params: [matchId, donationAmountWei],
				value: donationAmountWei, // Ensure to pass the value for the payable function
			});

			sendTransaction(config, {
				onSuccess: () => {
					setToast({
						show: true,
						message: "Donation successful!",
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
					<CardTitle>Donate to a Match</CardTitle>
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
							<Label htmlFor="donationAmount">
								Donation Amount (USD)
							</Label>
							<Input
								type="number"
								name="donationAmount"
								id="donationAmount"
								value={donationAmount}
								onChange={handleDonationAmountChange}
								placeholder="Enter donation amount in USD"
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
								"Donate"
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

export default DonateToMatch;
