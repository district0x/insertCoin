"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { useToast } from "@/lib/hooks/use-toast";
import { saveWalletToDb } from "@/lib/actions/wallet";
import { MTK_TOKEN } from "@/lib/constants/tokens";

export function useWalletConnection() {
  const { address, isConnected, status } = useAccount();
  const { toast } = useToast();
  const savedAddressRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const hasShownToastRef = useRef(false);
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();

  const addTokenToWallet = useCallback(async () => {
    if (!window.ethereum) {
      console.warn("MetaMask not found");
      return;
    }

    try {
      // Request to add the token to the user's wallet
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: MTK_TOKEN.address,
            symbol: MTK_TOKEN.symbol,
            decimals: MTK_TOKEN.decimals,
            name: MTK_TOKEN.name,
          },
        },
      });

      toast({
        title: "Token Added",
        description: "MTK token has been added to your wallet.",
      });
    } catch (error) {
      console.error("Error adding token to wallet:", error);
      if (error instanceof Error && error.message.includes("User rejected")) {
        // User rejected the token addition
        return;
      }
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Failed to add MTK token to your wallet. You can add it manually.",
      });
    }
  }, [toast]);

  const checkAndAddToken = useCallback(async () => {
    if (!address || !publicClient) return;

    try {
      // Check if the user already has MTK token balance or allowance
      const tokenBalance = await publicClient.readContract({
        address: MTK_TOKEN.address,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [address],
      });

      // If user has no balance, prompt to add token
      if (tokenBalance === 0n) {
        await addTokenToWallet();
      }
    } catch (error) {
      console.error("Error checking token balance:", error);
      // If there's an error reading the balance, still try to add the token
      await addTokenToWallet();
    }
  }, [address, publicClient, addTokenToWallet]);

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

        // Check and add MTK token after successful wallet connection
        await checkAndAddToken();

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
  }, [address, isConnected, status, toast, saveWallet, checkAndAddToken]);

  return {
    address,
    isConnected,
    connect,
    disconnect,
  };
}
