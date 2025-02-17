"use client";

import { useEffect } from "react";
import { useConnect, useAccount } from "wagmi";
import { injected } from "wagmi/connectors";
import { useLocalStorage } from "./useLocalStorage";

export function useAutoConnect() {
  const { connect } = useConnect();
  const { isConnected } = useAccount();
  const [shouldAutoConnect, setShouldAutoConnect] = useLocalStorage(
    "shouldAutoConnect",
    true
  );

  useEffect(() => {
    // Only attempt to connect if:
    // 1. We're not already connected
    // 2. User hasn't explicitly disabled auto-connect
    // 3. MetaMask is available
    if (!isConnected && shouldAutoConnect && window.ethereum) {
      connect({ connector: injected() });
    }
  }, [connect, isConnected, shouldAutoConnect]);

  return {
    isConnected,
    shouldAutoConnect,
    setShouldAutoConnect,
  };
}
