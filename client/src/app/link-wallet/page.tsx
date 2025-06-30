"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, Loader2, Shield, Users, Zap, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { linkDiscordToWallet } from "@/lib/services/user";

export default function LinkWalletPage() {
    const { user, authenticated, login, ready } = usePrivy();
    const { toast } = useToast();
    const router = useRouter();

    const [isLinking, setIsLinking] = useState(false);
    const [isLinked, setIsLinked] = useState(false);
    const [discordId, setDiscordId] = useState<string | null>(null);
    const [manualDiscordId, setManualDiscordId] = useState("");

    // Check if user has Discord ID from OAuth
    useEffect(() => {
        if (user?.discord && 'id' in user.discord && user.discord.id) {
            setDiscordId(user.discord.id as string);
        }
    }, [user]);

    // Auto-link when user is authenticated and has both Discord ID and wallet
    useEffect(() => {
        if (authenticated && user && !isLinking && !isLinked &&
            user?.discord && 'id' in user.discord && user.discord.id &&
            user?.wallet?.address) {
            handleAutoLink();
        }
    }, [authenticated, user, isLinking, isLinked]);

    const handleAutoLink = async () => {
        const finalDiscordId = discordId || manualDiscordId;

        console.log('[DEBUG] handleAutoLink called with:', {
            discordId,
            manualDiscordId,
            finalDiscordId,
            walletAddress: user?.wallet?.address,
            user: user
        });

        if (!finalDiscordId || !user?.wallet?.address) {
            console.log('[DEBUG] Missing required data:', {
                hasDiscordId: !!finalDiscordId,
                hasWalletAddress: !!user?.wallet?.address
            });
            return;
        }

        // Validate inputs before calling service
        if (typeof finalDiscordId !== 'string' || finalDiscordId.trim() === '') {
            console.error('[DEBUG] Invalid Discord ID:', finalDiscordId);
            toast({
                title: "❌ Invalid Discord ID",
                description: "Please enter a valid Discord ID",
                variant: "destructive",
            });
            return;
        }

        if (typeof user.wallet.address !== 'string' || !user.wallet.address.startsWith('0x')) {
            console.error('[DEBUG] Invalid wallet address:', user.wallet.address);
            toast({
                title: "❌ Invalid Wallet Address",
                description: "Please connect a valid wallet",
                variant: "destructive",
            });
            return;
        }

        setIsLinking(true);
        try {
            console.log('[DEBUG] Calling linkDiscordToWallet with:', {
                discordId: finalDiscordId,
                walletAddress: user.wallet.address
            });

            await linkDiscordToWallet({
                discordId: finalDiscordId,
                walletAddress: user.wallet.address,
            });

            setIsLinked(true);
            toast({
                title: "✅ Wallet Linked Successfully!",
                description: "Your Discord account is now linked to your wallet.",
            });
        } catch (error) {
            console.error("Error linking wallet:", error);
            toast({
                title: "❌ Linking Failed",
                description: error instanceof Error ? error.message : "Failed to link wallet",
                variant: "destructive",
            });
        } finally {
            setIsLinking(false);
        }
    };

    const handleConnect = () => {
        login();
    };

    const getWalletDisplay = () => {
        if (user?.wallet?.address) {
            return `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`;
        }
        if (user?.email?.address) {
            return `Gmail: ${user.email.address}`;
        }
        return "No wallet connected";
    };

    const getDiscordDisplay = () => {
        if (user?.discord && 'username' in user.discord && user.discord.username) {
            return `@${user.discord.username}`;
        }
        if (discordId) {
            return `Discord ID: ${discordId}`;
        }
        if (manualDiscordId) {
            return `Manual Discord ID: ${manualDiscordId}`;
        }
        return "No Discord connected";
    };

    const canLink = () => {
        const hasDiscordId = discordId || manualDiscordId;
        const hasWallet = user?.wallet?.address;
        return hasDiscordId && hasWallet;
    };

    if (!ready) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (isLinked) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12">
                <div className="container mx-auto px-4">
                    <div className="max-w-2xl mx-auto text-center">
                        <Card className="bg-white shadow-lg">
                            <CardHeader className="text-center">
                                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                                <CardTitle className="text-2xl text-green-900">
                                    Wallet Linked Successfully!
                                </CardTitle>
                                <CardDescription className="text-green-700">
                                    Your Discord account is now connected to your wallet
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <h3 className="font-semibold text-gray-900 mb-2">Discord Account</h3>
                                        <p className="text-sm text-gray-600">{getDiscordDisplay()}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <h3 className="font-semibold text-gray-900 mb-2">Wallet Address</h3>
                                        <p className="text-sm text-gray-600 font-mono">{getWalletDisplay()}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-semibold text-gray-900">What's Next?</h3>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <p>• Use <code className="bg-gray-100 px-1 rounded">/profile</code> in Discord to view your stats</p>
                                        <p>• Create matches with <code className="bg-gray-100 px-1 rounded">/create-match</code></p>
                                        <p>• Your wallet will be automatically used for transactions</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => router.push("/matches")}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        View Matches
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => window.close()}
                                        className="flex-1"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            🔗 Link Your Wallet to Discord
                        </h1>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Connect your wallet to Discord for secure match creation and statistics tracking.
                            Works with Gmail, Discord, Google, and traditional wallets!
                        </p>
                    </div>

                    {/* Main Content */}
                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        {/* Connection Card */}
                        <div className="flex justify-center">
                            <Card className="w-full max-w-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {authenticated ? (
                                            <>
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                                Connected
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="h-5 w-5 text-orange-500" />
                                                Connect Wallet
                                            </>
                                        )}
                                    </CardTitle>
                                    <CardDescription>
                                        {authenticated
                                            ? "Your wallet is connected. Click below to link to Discord."
                                            : "Connect your wallet to get started"
                                        }
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {authenticated ? (
                                        <>
                                            <div className="space-y-3">
                                                <div className="p-3 bg-gray-50 rounded-lg">
                                                    <h4 className="font-medium text-gray-900 mb-1">Discord Account</h4>
                                                    <p className="text-sm text-gray-600">{getDiscordDisplay()}</p>
                                                </div>
                                                <div className="p-3 bg-gray-50 rounded-lg">
                                                    <h4 className="font-medium text-gray-900 mb-1">Wallet Address</h4>
                                                    <p className="text-sm text-gray-600 font-mono">{getWalletDisplay()}</p>
                                                </div>
                                            </div>

                                            {/* Manual Discord ID Input for Development */}
                                            {!discordId && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="discord-id" className="text-sm font-medium">
                                                        Discord ID (for testing)
                                                    </Label>
                                                    <Input
                                                        id="discord-id"
                                                        placeholder="Enter your Discord ID (e.g., 123456789)"
                                                        value={manualDiscordId}
                                                        onChange={(e) => setManualDiscordId(e.target.value)}
                                                        className="text-sm"
                                                    />
                                                    <div className="flex items-start gap-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                        <p>
                                                            Discord OAuth doesn't work on localhost. Enter your Discord ID manually for testing.
                                                            In production, this will be automatic.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {isLinking ? (
                                                <Button disabled className="w-full">
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    Linking...
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleAutoLink}
                                                    className="w-full bg-green-600 hover:bg-green-700"
                                                    disabled={!canLink()}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                    Link to Discord
                                                </Button>
                                            )}

                                            {!canLink() && (
                                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                    <p className="text-sm text-yellow-800">
                                                        {!user?.wallet?.address && !discordId && !manualDiscordId
                                                            ? "Please connect both Discord and a wallet to continue."
                                                            : !user?.wallet?.address
                                                                ? "Please connect a wallet to continue."
                                                                : "Please connect your Discord account to continue."
                                                        }
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <Button
                                            onClick={handleConnect}
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Zap className="h-4 w-4 mr-2" />
                                            Connect Wallet
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Benefits */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="h-5 w-5 text-green-500" />
                                        Why Link Your Wallet?
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">Secure Match Creation</h4>
                                                <p className="text-sm text-gray-600">Create matches directly from Discord with your wallet</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">Track Your Stats</h4>
                                                <p className="text-sm text-gray-600">View your match history and statistics</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">Fair Play</h4>
                                                <p className="text-sm text-gray-600">Prevents multi-accounting and ensures fair competition</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">Easy Setup</h4>
                                                <p className="text-sm text-gray-600">Works with Gmail, Discord, Google, and traditional wallets</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5 text-blue-500" />
                                        Supported Connection Methods
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="font-medium text-gray-900">Gmail</h4>
                                            <p className="text-sm text-gray-600">Automatic wallet creation - no crypto knowledge needed</p>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">Discord</h4>
                                            <p className="text-sm text-gray-600">Direct linking with your Discord account</p>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">Traditional Wallets</h4>
                                            <p className="text-sm text-gray-600">MetaMask, Trust Wallet, Coinbase Wallet, etc.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Zap className="h-5 w-5 text-purple-500" />
                                        💡 How It Works
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <p>1. Connect with your preferred method (Gmail/Discord/Google/Wallet)</p>
                                        <p>2. Your wallet and Discord account are automatically linked</p>
                                        <p>3. Use Discord commands to create matches and view stats</p>
                                        <p>4. Your wallet is used for all transactions automatically</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 