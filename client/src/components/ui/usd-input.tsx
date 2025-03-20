"use client";

import { useEthPrice } from "@/lib/hooks/useEthPrice";
import { Input } from "./input";
import { Label } from "./label";
import { formatUnits } from "viem";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface UsdInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  onEthChange?: (ethValue: bigint) => void;
  className?: string;
  error?: string;
  min?: number;
  max?: number;
}

export function UsdInput({
  label = "Amount (USD)",
  onEthChange,
  className,
  error,
  min = 0,
  max = 1000000, // $1M default max
  ...props
}: UsdInputProps) {
  const { ethPrice, loading, convertUsdToEth } = useEthPrice();
  const [usdValue, setUsdValue] = useState<string>("");
  const [ethEquivalent, setEthEquivalent] = useState<string>("0");
  const [validationError, setValidationError] = useState<string | null>(null);
  const isInitialRender = useRef(true);
  const ethAmountRef = useRef<bigint>(0n);

  // First effect to calculate ethEquivalent without triggering onEthChange
  useEffect(() => {
    if (usdValue && !isNaN(parseFloat(usdValue))) {
      const numericValue = parseFloat(usdValue);
      
      // Validate min/max constraints
      if (numericValue < min) {
        setValidationError(`Minimum amount is $${min}`);
        ethAmountRef.current = 0n;
        setEthEquivalent("0");
        return;
      }
      
      if (numericValue > max) {
        setValidationError(`Maximum amount is $${max.toLocaleString()}`);
        ethAmountRef.current = 0n;
        setEthEquivalent("0");
        return;
      }
      
      setValidationError(null);
      
      try {
        const ethAmount = convertUsdToEth(numericValue);
        ethAmountRef.current = ethAmount;
        setEthEquivalent(formatUnits(ethAmount, 18));
      } catch (err) {
        console.error("Error converting USD to ETH:", err);
        setValidationError("Invalid amount");
        ethAmountRef.current = 0n;
        setEthEquivalent("0");
      }
    } else {
      setEthEquivalent("0");
      setValidationError(null);
      ethAmountRef.current = 0n;
    }
  }, [usdValue, ethPrice, convertUsdToEth, min, max]);

  // Separate effect only for calling onEthChange
  useEffect(() => {
    // Skip the initial render to prevent state updates during hydration
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    // Call onEthChange only after calculating the ethAmount in the first effect
    if (onEthChange) {
      onEthChange(ethAmountRef.current);
    }
  }, [ethEquivalent, onEthChange]);

  const handleUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty string or valid numbers with up to 2 decimal places
    // Also prevent extremely large numbers by limiting to 10 digits total
    if (value === "" || (/^\d{1,10}(\.?\d{0,2})?$/.test(value) && value.length <= 12)) {
      setUsdValue(value);
    }
  };

  const displayError = error || validationError;

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
          className={cn(displayError && "border-red-500")}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          {loading ? "..." : `≈ ${parseFloat(ethEquivalent).toFixed(6)} ETH`}
        </div>
      </div>
      {displayError && <p className="text-sm text-red-500">{displayError}</p>}
    </div>
  );
}
