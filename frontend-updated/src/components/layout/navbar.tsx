"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center space-x-4">
          <Link href="/" className="font-bold">
            OneVOne
          </Link>
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/matches" className="text-sm font-medium">
              Matches
            </Link>
            <Link href="/tournaments" className="text-sm font-medium">
              Tournaments
            </Link>
          </div>
        </div>
        <div className="ml-auto flex items-center space-x-4">
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
