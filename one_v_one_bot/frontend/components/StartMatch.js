import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { ethers } from "ethers";
import { useSendTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import { Loader2 } from "lucide-react";
import { toWei } from "thirdweb/utils";

import Toast from "./Toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const processTransactionReceipt = (receipt) => {
	const gasUsed = ethers.utils.formatUnits(receipt.gasUsed, "wei");
	const effectiveGasPrice = ethers.utils.formatUnits(
		receipt.effectiveGasPrice,
		"gwei"
	);
	const totalGasCost = ethers.utils.formatEther(
		receipt.gasUsed.mul(receipt.effectiveGasPrice)
	);

	const eventLog = receipt.logs[0];
	const eventData = ethers.utils.defaultAbiCoder.decode(
		["uint256", "address", "uint256"],
		eventLog.data
	);

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
			matchId: eventData[0].toString(),
			player: eventData[1],
			amount: ethers.utils.formatEther(eventData[2]) + " ETH",
		},
	};
};

const StartMatch = () => {
	const [matchAmount, setMatchAmount] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
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

	const MAX_RETRIES = 10;
	const RETRY_DELAY = 3000; // 3 seconds

	const getReceiptWithRetry = async (provider, txHash, retries = 0) => {
		try {
			const receipt = await provider.getTransactionReceipt(txHash);
			if (receipt) {
				return receipt;
			} else if (retries < MAX_RETRIES) {
				await new Promise((resolve) =>
					setTimeout(resolve, RETRY_DELAY)
				);
				return getReceiptWithRetry(provider, txHash, retries + 1);
			} else {
				throw new Error("Max retries reached. Receipt not available.");
			}
		} catch (error) {
			if (retries < MAX_RETRIES) {
				await new Promise((resolve) =>
					setTimeout(resolve, RETRY_DELAY)
				);
				return getReceiptWithRetry(provider, txHash, retries + 1);
			} else {
				throw error;
			}
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

		setIsProcessing(true);

		try {
			const ethPriceInUsd = await getEthPriceInUsd();
			const matchAmountEth = (amount / ethPriceInUsd).toFixed(18);
			// const matchAmountWei = Math.floor(matchAmountEth * 1e18).toString();

			console.log("Match Amount in Wei: ", toWei(matchAmountEth));

			const config = prepareContractCall({
				contract,
				method: "startMatch",
				params: [toWei(matchAmountEth)],
				value: toWei(matchAmountEth),
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
							const processedReceipt =
								processTransactionReceipt(receipt);
							console.log(
								"Processed Transaction Receipt:",
								processedReceipt
							);

							// Post match info to Discord
							try {
								const discordResponse = await fetch(
									"/api/postMatchToDiscord",
									{
										method: "POST",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											matchId:
												processedReceipt.eventData
													.matchId,
											content: `Match started successfully with Match ID: ${processedReceipt.eventData.matchId}`,
										}),
									}
								);

								if (!discordResponse.ok) {
									const errorData =
										await discordResponse.json();
									throw new Error(
										errorData.error ||
											"Failed to post match info to Discord"
									);
								}

								const discordResult =
									await discordResponse.json();
								console.log(
									"Match info posted to Discord successfully:",
									discordResult
								);
							} catch (discordError) {
								console.error(
									"Error posting to Discord:",
									discordError
								);
								// You might want to set a toast here to inform the user
								setToast({
									show: true,
									message: `Failed to post match info to Discord: ${discordError.message}`,
									type: "error",
								});
							}

							setToast({
								show: true,
								message: `Match started successfully! Match ID: ${processedReceipt.eventData.matchId}`,
								type: "success",
							});
						}
					} catch (receiptError) {
						console.error(
							"Failed to fetch transaction receipt:",
							receiptError
						);
						console.log(
							"Transaction hash for manual checking:",
							result.transactionHash
						);
						setToast({
							show: true,
							message:
								"Match started, but failed to fetch details. Transaction hash: " +
								result.transactionHash,
							type: "warning",
						});
					}
					setIsProcessing(false);
				},
				onError: (error) => {
					console.error("Transaction Error:", error);
					setToast({
						show: true,
						message: `Failed to start match: ${error.message}`,
						type: "error",
					});
					setIsProcessing(false);
				},
			});
		} catch (error) {
			console.error("Error starting match:", error);
			setToast({
				show: true,
				message: "Failed to start the match: " + error.message,
				type: "error",
			});
			setIsProcessing(false);
		}
	};

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Start a Match</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<Label htmlFor="matchAmount">
								Match Amount (USD)
							</Label>
							<Input
								type="number"
								name="matchAmount"
								id="matchAmount"
								value={matchAmount}
								onChange={handleChange}
								placeholder="Enter match amount in USD"
								required
							/>
						</div>
						<Button
							type="submit"
							disabled={isProcessing}
							className="w-full"
						>
							{isProcessing ? (
								<span className="flex items-center justify-center">
									<Loader2 className="animate-spin mr-2 h-5 w-5" />
								</span>
							) : (
								"Start Match"
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

export default StartMatch;
