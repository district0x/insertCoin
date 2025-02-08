"use client";

import { useWalletGuard } from "@/lib/hooks/useWalletGuard";
import { useAutoConnect } from "@/lib/hooks/useAutoConnect";
import { PropsWithChildren } from "react";

export function WalletGuardProvider({ children }: PropsWithChildren) {
  // Initialize wallet guard hook
  useWalletGuard();

  // Initialize auto-connect
  useAutoConnect();

  return <>{children}</>;
}
