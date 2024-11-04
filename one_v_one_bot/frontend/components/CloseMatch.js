import React, { useState } from "react";
import { getContract, prepareContractCall } from "thirdweb";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import { Loader2 } from "lucide-react";

import Toast from "./Toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const CloseMatch = () => {
	const [matchId, setMatchId] = useState("");
	const [winnerAddress, setWinnerAddress] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [transactionData, setTransactionData] = useState(null);
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

	const { mutate: sendAndConfirmTransaction, data: transactionReceipt } =
		useSendAndConfirmTransaction();

	const handleMatchIdChange = (event) => setMatchId(event.target.value);
	const handleWinnerAddressChange = (event) =>
		setWinnerAddress(event.target.value);

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

	const weiToUsd = async (weiAmount) => {
		const ethPrice = await getEthPriceInUsd();
		const ethAmount = Number(weiAmount) / 1e18; // Convert wei to ETH
		return (ethAmount * ethPrice).toFixed(2);
	};

	const parseTransactionLogs = async (receipt) => {
		console.log("Parsing transaction logs...");
		console.log("Receipt:", receipt);

		if (!receipt || !receipt.logs) {
			console.error("Receipt or logs are undefined");
			return null;
		}

		console.log("Number of logs:", receipt.logs.length);

		if (receipt.logs.length === 0) {
			console.warn("No logs found in the receipt");
			return null;
		}

		try {
			const log = receipt.logs[0];
			console.log("Log data:", log.data);

			const data = log.data.slice(2).match(/.{1,64}/g);

			if (data.length < 5) {
				console.warn(
					"Log data does not contain expected number of parameters"
				);
				return null;
			}

			const matchId = parseInt(data[0], 16).toString();
			const winner = "0x" + data[1].slice(24);
			const winnerAmount = BigInt("0x" + data[2]).toString();
			const multisigAmount = BigInt("0x" + data[3]).toString();
			const poolAmount = BigInt("0x" + data[4]).toString();

			const winnerAmountUsd = await weiToUsd(winnerAmount);
			const multisigAmountUsd = await weiToUsd(multisigAmount);
			const poolAmountUsd = await weiToUsd(poolAmount);

			console.log("Parsed data:", {
				matchId,
				winner,
				winnerAmount,
				multisigAmount,
				poolAmount,
				winnerAmountUsd,
				multisigAmountUsd,
				poolAmountUsd,
			});

			return {
				matchId,
				winner,
				winnerAmount,
				multisigAmount,
				poolAmount,
				winnerAmountUsd,
				multisigAmountUsd,
				poolAmountUsd,
			};
		} catch (error) {
			console.error("Error parsing logs:", error);
			return null;
		}
	};

	const postMatchToDiscord = async (matchData) => {
		try {
			const discordResponse = await fetch("/api/postMatchToDiscord", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					matchId: matchData.matchId,
					content: `
Match Closed:
- Match ID: ${matchData.matchId}
- Winner: ${matchData.winner}
- Winner Amount: ${matchData.winnerAmount} wei (${matchData.winnerAmountUsd} USD)
- Multisig Amount: ${matchData.multisigAmount} wei (${matchData.multisigAmountUsd} USD)
- Pool Amount: ${matchData.poolAmount} wei (${matchData.poolAmountUsd} USD)
          `,
				}),
			});

			if (!discordResponse.ok) {
				throw new Error(
					`Discord API responded with status ${discordResponse.status}`
				);
			}

			console.log("Match posted to Discord successfully");
		} catch (error) {
			console.error("Failed to post match to Discord:", error);
			throw error;
		}
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setIsProcessing(true);

		const config = prepareContractCall({
			contract,
			method: "closeMatch",
			params: [matchId, winnerAddress],
		});

		console.log("Prepared contract call config:", config);

		sendAndConfirmTransaction(config, {
			onSuccess: async (receipt) => {
				console.log("Transaction successful. Receipt:", receipt);
				const parsedData = await parseTransactionLogs(receipt);
				setTransactionData(parsedData);

				if (parsedData) {
					try {
						await postMatchToDiscord(parsedData);
						setToast({
							show: true,
							message: `Match closed successfully and posted to Discord! Transaction hash: ${receipt.transactionHash}`,
							type: "success",
						});
					} catch (error) {
						setToast({
							show: true,
							message: `Match closed successfully, but failed to post to Discord. Transaction hash: ${receipt.transactionHash}`,
							type: "warning",
						});
					}
				} else {
					setToast({
						show: true,
						message: `Match closed successfully, but failed to parse transaction data. Transaction hash: ${receipt.transactionHash}`,
						type: "warning",
					});
				}

				setIsProcessing(false);
			},
			onError: (error) => {
				console.error("Transaction error:", error);
				setToast({ show: true, message: error.message, type: "error" });
				setIsProcessing(false);
			},
		});
	};

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Close a Match</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
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
							<Label htmlFor="winnerAddress">
								Winner Address
							</Label>
							<Input
								type="text"
								name="winnerAddress"
								id="winnerAddress"
								value={winnerAddress}
								onChange={handleWinnerAddressChange}
								placeholder="Enter winner's address"
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
								"Close Match"
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

export default CloseMatch;
