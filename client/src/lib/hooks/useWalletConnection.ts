"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useToast } from "@/lib/hooks/use-toast";
import { saveWalletToDb } from "@/lib/actions/wallet";
import { MATCH_TOKEN } from "@/lib/constants/tokens";

export function useWalletConnection() {
  const {
    user,
    authenticated,
    login,
    logout,
    ready,
    sendTransaction
  } = usePrivy();
  const { toast } = useToast();
  const savedAddressRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const hasShownToastRef = useRef(false);

  // Get the connected external wallet address with priority system
  const address = useMemo(() => {
    if (!user) return null;

    // Priority order: User's linked external wallet > null
    if (user.linkedAccounts && user.linkedAccounts.length > 0) {
      const walletAccount = user.linkedAccounts.find(account =>
        account.type === 'wallet' && account.verifiedAt
      );
      if (walletAccount && 'address' in walletAccount) {
        console.log("Found linked external wallet:", walletAccount.address);
        return walletAccount.address as `0x${string}`;
      }
    }

    // Don't fall back to embedded wallet - require external wallet connection
    console.log("No external wallet found. User needs to connect an external wallet.");
    return null;
  }, [user]);

  // Check if the user has an external wallet connected
  const isExternalWallet = useMemo(() => {
    if (!user?.linkedAccounts) return false;
    return user.linkedAccounts.some(account =>
      account.type === 'wallet' && account.verifiedAt
    );
  }, [user]);

  const addTokenToWallet = useCallback(async () => {
    if (!user?.wallet) {
      console.warn("No wallet found");
      return;
    }

    try {
      // Request to add the token to the user's wallet
      await (user.wallet as any).request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: MATCH_TOKEN.address,
            symbol: MATCH_TOKEN.symbol,
            decimals: MATCH_TOKEN.decimals,
            name: MATCH_TOKEN.name,
          },
        },
      });

      toast({
        title: "Token Added",
        description: "MATCH token has been added to your wallet.",
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
          "Failed to add MATCH token to your wallet. You can add it manually.",
      });
    }
  }, [user?.wallet, toast]);

  const checkAndAddToken = useCallback(async () => {
    if (!user?.wallet?.address) return;

    try {
      // Check if the user already has MATCH token balance
      const tokenBalance = await (user.wallet as any).request({
        method: "eth_call",
        params: [
          {
            to: MATCH_TOKEN.address,
            data: `0x70a08231000000000000000000000000${user.wallet.address.slice(2)}`,
          },
          "latest",
        ],
      });

      // If user has no balance, prompt to add token
      if (tokenBalance === "0x0") {
        await addTokenToWallet();
      }
    } catch (error) {
      console.error("Error checking token balance:", error);
      // If there's an error reading the balance, still try to add the token
      await addTokenToWallet();
    }
  }, [user?.wallet, addTokenToWallet]);

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
    // Skip if not ready or not authenticated
    if (!ready || !authenticated) {
      return;
    }

    if (!address) {
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

        // Check and add MATCH token after successful wallet connection
        await checkAndAddToken();

        // Only show toast if we haven't shown it before for this session
        if (!hasShownToastRef.current) {
          toast({
            title: "Wallet Connected",
            description:
              "Your external wallet has been successfully connected and saved.",
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
  }, [ready, authenticated, address, toast, saveWallet, checkAndAddToken]);

  return {
    address,
    isConnected: authenticated && !!address,
    isExternalWallet,
    connect: login,
    disconnect: logout,
    user,
    authenticated,
    ready,
    sendTransaction,
  };
}
