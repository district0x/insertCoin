import { WalletSignatureHelper } from "@/components/WalletSignatureHelper";

export default function WalletSignaturePage() {
    return (
        <div className="container mx-auto py-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-4">Wallet Signature Helper</h1>
                    <p className="text-muted-foreground">
                        Generate a wallet signature to link your Discord account with your Ethereum wallet.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Signature Helper */}
                    <div>
                        <WalletSignatureHelper />
                    </div>

                    {/* Instructions */}
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-100">
                                Why Sign a Message?
                            </h2>
                            <p className="text-blue-800 dark:text-blue-200 text-sm">
                                Signing a message proves that you own the wallet address. This prevents
                                others from linking your wallet to their Discord account without your permission.
                            </p>
                        </div>

                        <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-green-900 dark:text-green-100">
                                Security Benefits
                            </h2>
                            <ul className="text-green-800 dark:text-green-200 text-sm space-y-2">
                                <li>• Prevents unauthorized wallet linking</li>
                                <li>• Ensures 1:1 Discord to wallet mapping</li>
                                <li>• Protects against multi-accounting</li>
                                <li>• Maintains fair play in matches</li>
                            </ul>
                        </div>

                        <div className="bg-orange-50 dark:bg-orange-950 p-6 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-orange-900 dark:text-orange-100">
                                How It Works
                            </h2>
                            <ol className="text-orange-800 dark:text-orange-200 text-sm space-y-2">
                                <li>1. Connect your wallet to this page</li>
                                <li>2. Click "Sign Message" to generate a signature</li>
                                <li>3. Copy the signature and Discord command</li>
                                <li>4. Use the command in Discord to link your wallet</li>
                                <li>5. Your wallet is now securely linked to Discord!</li>
                            </ol>
                        </div>

                        <div className="bg-purple-50 dark:bg-purple-950 p-6 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-100">
                                Discord Commands
                            </h2>
                            <div className="text-purple-800 dark:text-purple-200 text-sm space-y-2">
                                <p><strong>/link-wallet</strong> - Link your wallet to Discord</p>
                                <p><strong>/profile</strong> - View your match statistics</p>
                                <p><strong>/wallet-info</strong> - Check your linked wallet</p>
                                <p><strong>/unlink-wallet</strong> - Unlink your wallet</p>
                                <p><strong>/help</strong> - Get help with all commands</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 