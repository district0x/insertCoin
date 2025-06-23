import { PrivyClientConfig } from '@privy-io/react-auth';

export const privyConfig: PrivyClientConfig = {
    appearance: {
        theme: 'light',
        accentColor: '#6366f1',
        logo: 'https://your-logo-url.com/logo.png', // Replace with your logo URL
        showWalletLoginFirst: false,
    },
    loginMethods: ['email', 'wallet', 'google', 'discord', 'twitter'],
    embeddedWallets: {
        createOnLogin: 'all-users',
    },
    defaultChain: {
        id: 84532,
        name: 'Base Sepolia',
        rpcUrls: {
            http: ['https://sepolia.base.org'],
            webSocket: ['wss://sepolia.base.org'],
        },
        nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18,
        },
        blockExplorers: {
            default: {
                name: 'Base Sepolia Explorer',
                url: 'https://sepolia.basescan.org',
            },
        },
    },
    supportedChains: [
        {
            id: 84532,
            name: 'Base Sepolia',
            rpcUrls: {
                http: ['https://sepolia.base.org'],
                webSocket: ['wss://sepolia.base.org'],
            },
            nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
            },
            blockExplorers: {
                default: {
                    name: 'Base Sepolia Explorer',
                    url: 'https://sepolia.basescan.org',
                },
            },
        },
    ],
}; 