"use client";

import { useWalletGuard } from "@/lib/hooks/useWalletGuard";
import { PropsWithChildren } from "react";

export function WalletGuardProvider({ children }: PropsWithChildren) {
  // Initialize wallet guard hook
  useWalletGuard();

  return <>{children}</>;
}
