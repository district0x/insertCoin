import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter, usePathname } from "next/navigation";

export function useWalletGuard() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip redirection for home page
    if (pathname === "/") return;

    // Redirect to home if wallet is not connected
    if (!isConnected) {
      router.replace("/");
    }
  }, [isConnected, pathname, router]);

  return {
    isConnected,
  };
}
