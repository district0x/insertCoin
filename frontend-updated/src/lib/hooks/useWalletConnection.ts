"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useToast } from "@/lib/hooks/use-toast";
import { saveWalletToDb } from "@/lib/actions/wallet";

export function useWalletConnection() {
  const { address, isConnected, status } = useAccount();
  const { toast } = useToast();
  const savedAddressRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const hasShownToastRef = useRef(false);
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const saveWallet = useCallback(async (address: string) => {
    try {
      const result = await saveWalletToDb({ address });
      if (!result.success) {
        throw new Error("Failed to save wallet");
      }
    } catch (error) {
      console.error("Error saving wallet:", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Skip if we're still connecting or already initialized this address
    if (status === "connecting" || !isConnected || !address) {
      return;
    }

    // Skip if we've already saved this address
    if (address === savedAddressRef.current) {
      return;
    }

    // Skip initial render
    if (!initializedRef.current) {
      initializedRef.current = true;
      savedAddressRef.current = address;
      return;
    }

    const handleWalletConnection = async () => {
      try {
        await saveWallet(address);
        savedAddressRef.current = address;

        // Only show toast if we haven't shown it before for this session
        if (!hasShownToastRef.current) {
          toast({
            title: "Wallet Connected",
            description:
              "Your wallet has been successfully connected and saved.",
          });
          hasShownToastRef.current = true;
        }
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to save wallet information",
          variant: "destructive",
        });
      }
    };

    handleWalletConnection();
  }, [address, isConnected, status, toast, saveWallet]);

  return {
    address,
    isConnected,
    connect,
    disconnect,
  };
}
