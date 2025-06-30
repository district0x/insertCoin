import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, usePathname } from "next/navigation";

export function useWalletGuard() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip redirection for home page
    if (pathname === "/") return;

    // Wait for Privy to be ready before checking authentication
    if (!ready) return;

    // Redirect to home if wallet is not connected
    if (!authenticated) {
      router.replace("/");
    }
  }, [authenticated, ready, pathname, router]);

  return {
    isConnected: authenticated,
  };
}
