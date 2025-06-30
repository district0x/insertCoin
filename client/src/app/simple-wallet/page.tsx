import { SimpleWalletLinking } from "@/components/SimpleWalletLinking";

export default function SimpleWalletPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            🔗 Simple Wallet Linking
                        </h1>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Link your Ethereum wallet to Discord in just a few simple steps.
                            No technical knowledge required!
                        </p>
                    </div>

                    {/* Main Content */}
                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        {/* Simple Linking Component */}
                        <div className="flex justify-center">
                            <SimpleWalletLinking />
                        </div>

                        {/* Instructions */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-lg p-6 shadow-sm">
                                <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                                    Why This Method?
                                </h2>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-green-600 text-sm font-bold">✓</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Super Simple</h3>
                                            <p className="text-sm text-gray-600">Just send a small amount to verify ownership</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-green-600 text-sm font-bold">✓</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Works with Any Wallet</h3>
                                            <p className="text-sm text-gray-600">MetaMask, Trust Wallet, Coinbase Wallet, etc.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-green-600 text-sm font-bold">✓</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Mobile Friendly</h3>
                                            <p className="text-sm text-gray-600">Works perfectly on mobile devices</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-green-600 text-sm font-bold">✓</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Secure</h3>
                                            <p className="text-sm text-gray-600">Only you can send from your wallet</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg p-6 shadow-sm">
                                <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                                    How It Works
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-600 font-bold text-sm">1</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Enter Your Wallet Address</h3>
                                            <p className="text-sm text-gray-600">Copy your wallet address from MetaMask or any other wallet</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-600 font-bold text-sm">2</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Send Verification Amount</h3>
                                            <p className="text-sm text-gray-600">Send exactly 0.001 ETH to our verification address</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-600 font-bold text-sm">3</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Copy Transaction Hash</h3>
                                            <p className="text-sm text-gray-600">Find the transaction hash in your wallet after sending</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-600 font-bold text-sm">4</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Complete in Discord</h3>
                                            <p className="text-sm text-gray-600">Use the generated command in your Discord server</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                                <h2 className="text-xl font-semibold mb-3 text-yellow-900">
                                    💡 Pro Tip
                                </h2>
                                <p className="text-yellow-800 text-sm">
                                    The 0.001 ETH verification amount is sent to our verification wallet.
                                    This is a one-time fee to prove you own the wallet. The amount is small
                                    (about $2-3) and helps prevent spam while ensuring security.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Alternative Methods */}
                    <div className="mt-12 bg-white rounded-lg p-6 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                            Alternative Methods
                        </h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="p-4 border rounded-lg">
                                <h3 className="font-semibold text-gray-900 mb-2">🔐 Signature Method</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    For advanced users who want to use cryptographic signatures
                                </p>
                                <a
                                    href="/wallet-signature"
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    Try Signature Method →
                                </a>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <h3 className="font-semibold text-gray-900 mb-2">🤖 Collab.Land</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    One-click verification through Collab.Land (coming soon)
                                </p>
                                <span className="text-gray-400 text-sm font-medium">
                                    Coming Soon
                                </span>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <h3 className="font-semibold text-gray-900 mb-2">📱 Mobile App</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Dedicated mobile app for wallet linking (future)
                                </p>
                                <span className="text-gray-400 text-sm font-medium">
                                    Future Release
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* FAQ */}
                    <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                            Frequently Asked Questions
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium text-gray-900 mb-2">
                                    Why do I need to send ETH to verify?
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Only you can send from your wallet, so this proves you own it.
                                    It's like showing your ID - but for your wallet!
                                </p>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-2">
                                    What if I don't have ETH?
                                </h3>
                                <p className="text-sm text-gray-600">
                                    You can buy ETH from exchanges like Coinbase, Binance, or use
                                    services like MoonPay. The amount needed is very small (about $2-3).
                                </p>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-2">
                                    Is this safe?
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Yes! We only ask you to send a small amount to our verified address.
                                    We never ask for your private keys or seed phrase.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-2">
                                    What if I make a mistake?
                                </h3>
                                <p className="text-sm text-gray-600">
                                    No worries! You can always try again. If you send the wrong amount,
                                    just send the correct amount and use that transaction hash.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 