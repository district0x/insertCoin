"use client";

import { UsdInput } from "@/components/ui/usd-input";
import { useState } from "react";
import { useMatch } from "@/lib/hooks/useMatch";

export default function CreateMatchPage() {
  const [ethAmount, setEthAmount] = useState<bigint>(0n);
  const { createMatch } = useMatch();

  const handleCreateMatch = async () => {
    try {
      await createMatch(ethAmount);
    } catch (error) {
      console.error("Error creating match:", error);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create a Match</h1>

      <UsdInput
        label="Match Amount (USD)"
        onEthChange={setEthAmount}
        placeholder="Enter amount in USD"
      />

      <button
        onClick={handleCreateMatch}
        disabled={ethAmount === 0n}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md disabled:opacity-50"
      >
        Create Match
      </button>
    </div>
  );
}
