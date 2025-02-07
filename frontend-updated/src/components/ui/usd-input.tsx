"use client";

import { useEthPrice } from "@/lib/hooks/useEthPrice";
import { Input } from "./input";
import { Label } from "./label";
import { formatUnits } from "viem";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface UsdInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  onEthChange?: (ethValue: bigint) => void;
  className?: string;
  error?: string;
}

export function UsdInput({
  label = "Amount (USD)",
  onEthChange,
  className,
  error,
  ...props
}: UsdInputProps) {
  const { ethPrice, loading, convertUsdToEth } = useEthPrice();
  const [usdValue, setUsdValue] = useState<string>("");
  const [ethEquivalent, setEthEquivalent] = useState<string>("0");

  useEffect(() => {
    if (usdValue && !isNaN(parseFloat(usdValue))) {
      const ethAmount = convertUsdToEth(parseFloat(usdValue));
      setEthEquivalent(formatUnits(ethAmount, 18));
      onEthChange?.(ethAmount);
    } else {
      setEthEquivalent("0");
      onEthChange?.(0n);
    }
  }, [usdValue, ethPrice, convertUsdToEth, onEthChange]);

  const handleUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string or valid numbers with up to 2 decimal places
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setUsdValue(value);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          {...props}
          type="text"
          value={usdValue}
          onChange={handleUsdChange}
          placeholder="0.00"
          className={cn(error && "border-red-500")}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          {loading ? "..." : `≈ ${parseFloat(ethEquivalent).toFixed(6)} ETH`}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
