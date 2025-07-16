"use client";

import React, { useState } from "react";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, CheckCircle, AlertCircle, Send, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimpleWalletLinkingProps {
    discordId?: string;
}

export function SimpleWalletLinking({ discordId }: SimpleWalletLinkingProps) {
    const { address, isConnected } = useWalletConnection();
    const { toast } = useToast();
    const [walletAddress, setWalletAddress] = useState("");
    const [transactionHash, setTransactionHash] = useState("");
    const [step, setStep] = useState<"input" | "verify" | "complete">("input");
    const [copied, setCopied] = useState(false);

    // Verification address (you would set this to your actual verification wallet)
    const VERIFICATION_ADDRESS = "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6";
    const VERIFICATION_AMOUNT = "0.001";

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast({
                title: "Copied to Clipboard",
                description: "Address copied successfully.",
            });
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            toast({
                title: "Copy Failed",
                description: "Failed to copy to clipboard.",
                variant: "destructive",
            });
        }
    };

    const handleStartVerification = () => {
        if (!walletAddress.trim()) {
            toast({
                title: "Wallet Address Required",
                description: "Please enter your wallet address.",
                variant: "destructive",
            });
            return;
        }

        if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
            toast({
                title: "Invalid Wallet Address",
                description: "Please enter a valid Ethereum address (0x...).",
                variant: "destructive",
            });
            return;
        }

        setStep("verify");
    };

    const handleVerifyTransaction = () => {
        if (!transactionHash.trim()) {
            toast({
                title: "Transaction Hash Required",
                description: "Please enter your transaction hash.",
                variant: "destructive",
            });
            return;
        }

        // In production, you would verify the transaction on-chain
        // For now, we'll simulate success
        setStep("complete");
        toast({
            title: "Verification Successful!",
            description: "Your wallet has been linked to Discord.",
        });
    };

    const generateDiscordCommand = () => {
        return `/verify-transaction ${transactionHash}`;
    };

    if (step === "input") {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Simple Wallet Linking
                    </CardTitle>
                    <CardDescription>
                        Link your wallet to Discord in just a few steps
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="wallet-address">Your Wallet Address</Label>
                        <Input
                            id="wallet-address"
                            placeholder="0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Enter your Ethereum wallet address (MetaMask, etc.)
                        </p>
                    </div>

                    <Button
                        onClick={handleStartVerification}
                        className="w-full"
                        disabled={!walletAddress.trim()}
                    >
                        Start Verification
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2 text-blue-900">
                            How it works:
                        </h4>
                        <ol className="text-xs text-blue-700 space-y-1">
                            <li>1. Enter your wallet address</li>
                            <li>2. Send a small amount to verify ownership</li>
                            <li>3. Use the transaction hash to complete linking</li>
                            <li>4. Your wallet is now linked to Discord!</li>
                        </ol>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (step === "verify") {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-blue-500" />
                        Send Verification Transaction
                    </CardTitle>
                    <CardDescription>
                        Send a small amount to verify you own this wallet
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Verification Address</Label>
                        <div className="flex gap-2">
                            <Input
                                value={VERIFICATION_ADDRESS}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(VERIFICATION_ADDRESS)}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Amount to Send</Label>
                        <Input
                            value={`${VERIFICATION_AMOUNT} ETH`}
                            readOnly
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2 text-yellow-900">
                            Steps to complete:
                        </h4>
                        <ol className="text-xs text-yellow-700 space-y-1">
                            <li>1. Copy the verification address above</li>
                            <li>2. Open your wallet (MetaMask, etc.)</li>
                            <li>3. Send exactly {VERIFICATION_AMOUNT} ETH to that address</li>
                            <li>4. Copy the transaction hash from your wallet</li>
                            <li>5. Paste it below and click "Verify"</li>
                        </ol>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="transaction-hash">Transaction Hash</Label>
                        <Input
                            id="transaction-hash"
                            placeholder="0x1234567890abcdef..."
                            value={transactionHash}
                            onChange={(e) => setTransactionHash(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Find this in your wallet after sending the transaction
                        </p>
                    </div>

                    <Button
                        onClick={handleVerifyTransaction}
                        className="w-full"
                        disabled={!transactionHash.trim()}
                    >
                        Verify Transaction
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => setStep("input")}
                        className="w-full"
                    >
                        Back
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (step === "complete") {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Verification Complete!
                    </CardTitle>
                    <CardDescription>
                        Your wallet has been successfully linked
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2 text-green-900">
                            ✅ Wallet Linked Successfully!
                        </h4>
                        <p className="text-xs text-green-700">
                            Your wallet {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} is now linked to Discord.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Discord Command</Label>
                        <div className="flex gap-2">
                            <Input
                                value={generateDiscordCommand()}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(generateDiscordCommand())}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Copy this command and use it in Discord to complete the linking
                        </p>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2 text-blue-900">
                            Next Steps:
                        </h4>
                        <ol className="text-xs text-blue-700 space-y-1">
                            <li>1. Go to your Discord server</li>
                            <li>2. Paste the command above</li>
                            <li>3. Press Enter to execute</li>
                            <li>4. Your wallet is now linked!</li>
                        </ol>
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => {
                            setStep("input");
                            setWalletAddress("");
                            setTransactionHash("");
                        }}
                        className="w-full"
                    >
                        Link Another Wallet
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return null;
} 