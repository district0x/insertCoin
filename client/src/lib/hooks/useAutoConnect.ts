"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useLocalStorage } from "./useLocalStorage";

export function useAutoConnect() {
  const { authenticated } = usePrivy();
  const [shouldAutoConnect, setShouldAutoConnect] = useLocalStorage(
    "shouldAutoConnect",
    true
  );

  // Privy handles auto-connection automatically, so we just need to track the state
  useEffect(() => {
    // Privy will automatically attempt to reconnect if the user was previously authenticated
    // We don't need to manually trigger connection like with wagmi
  }, [shouldAutoConnect]);

  return {
    isConnected: authenticated,
    shouldAutoConnect,
    setShouldAutoConnect,
  };
}
