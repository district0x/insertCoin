// components/WalletConnectWrapper.tsx
'use client';

import { ConnectWallet } from "@thirdweb-dev/react";

export function WalletConnectWrapper() {
    return (
        <div className="flex flex-col gap-2">
            <ConnectWallet
                theme="light"
                btnTitle="Connect Wallet"
                modalTitle="Connect to Trivia Game"
                modalSize="wide"
            />
        </div>
    );
}