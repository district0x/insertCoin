"use client";

import React, { useState } from "react";
import { useWalletConnection } from "@/lib/hooks/useWalletConnection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletSignatureHelperProps {
    discordId?: string;
}

export function WalletSignatureHelper({ discordId }: WalletSignatureHelperProps) {
    const { address, isConnected } = useWalletConnection();
    const { toast } = useToast();
    const [signature, setSignature] = useState("");
    const [isSigning, setIsSigning] = useState(false);
    const [copied, setCopied] = useState(false);

    // Generate the message to sign
    const generateMessage = () => {
        const userDiscordId = discordId || "YOUR_DISCORD_ID";
        return `Link Discord account ${userDiscordId} to wallet ${address}`;
    };

    const message = generateMessage();

    const signMessage = async () => {
        if (!isConnected || !address) {
            toast({
                title: "Wallet Not Connected",
                description: "Please connect your wallet first.",
                variant: "destructive",
            });
            return;
        }

        // Check if ethereum is available
        if (typeof window === 'undefined' || !window.ethereum) {
            toast({
                title: "Wallet Not Available",
                description: "Please install MetaMask or another Web3 wallet.",
                variant: "destructive",
            });
            return;
        }

        setIsSigning(true);
        try {
            // Request signature from wallet
            const signature = await (window.ethereum as any).request({
                method: "personal_sign",
                params: [message, address],
            });

            setSignature(signature);
            toast({
                title: "Signature Generated",
                description: "Copy the signature and use it in Discord.",
            });
        } catch (error) {
            console.error("Error signing message:", error);
            toast({
                title: "Signature Failed",
                description: "Failed to generate signature. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSigning(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast({
                title: "Copied to Clipboard",
                description: "Text copied successfully.",
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

    const copyMessage = () => copyToClipboard(message);
    const copySignature = () => copyToClipboard(signature);

    if (!isConnected) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        Wallet Not Connected
                    </CardTitle>
                    <CardDescription>
                        Connect your wallet to generate a signature for Discord linking.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Please connect your wallet using the wallet connection button above.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Wallet Signature Helper
                </CardTitle>
                <CardDescription>
                    Generate a signature to link your wallet to Discord.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Wallet Address */}
                <div className="space-y-2">
                    <Label htmlFor="wallet-address">Your Wallet Address</Label>
                    <div className="flex gap-2">
                        <Input
                            id="wallet-address"
                            value={address || ""}
                            readOnly
                            className="font-mono text-sm"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(address || "")}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Message to Sign */}
                <div className="space-y-2">
                    <Label htmlFor="message">Message to Sign</Label>
                    <div className="flex gap-2">
                        <Input
                            id="message"
                            value={message}
                            readOnly
                            className="font-mono text-sm"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={copyMessage}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        This message will be signed by your wallet to prove ownership.
                    </p>
                </div>

                {/* Sign Button */}
                <Button
                    onClick={signMessage}
                    disabled={isSigning}
                    className="w-full"
                >
                    {isSigning ? "Signing..." : "Sign Message"}
                </Button>

                {/* Signature Result */}
                {signature && (
                    <div className="space-y-2">
                        <Label htmlFor="signature">Generated Signature</Label>
                        <div className="flex gap-2">
                            <Input
                                id="signature"
                                value={signature}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={copySignature}
                            >
                                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Copy this signature and use it in the Discord command.
                        </p>
                    </div>
                )}

                {/* Discord Command */}
                {signature && (
                    <div className="space-y-2">
                        <Label>Discord Command</Label>
                        <div className="flex gap-2">
                            <Input
                                value={`/link-wallet ${address} ${signature}`}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(`/link-wallet ${address} ${signature}`)}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Copy and paste this command in Discord to link your wallet.
                        </p>
                    </div>
                )}

                {/* Instructions */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">How to Use:</h4>
                    <ol className="text-xs text-muted-foreground space-y-1">
                        <li>1. Click "Sign Message" to generate a signature</li>
                        <li>2. Copy the generated signature</li>
                        <li>3. Go to Discord and use the command: <code className="bg-background px-1 rounded">/link-wallet {address} &lt;signature&gt;</code></li>
                        <li>4. Your wallet will be linked to your Discord account</li>
                    </ol>
                </div>
            </CardContent>
        </Card>
    );
} 