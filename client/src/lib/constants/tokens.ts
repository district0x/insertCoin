// Token constants for the application

// MATCH Token details (the actual token on-chain)
export const MATCH_TOKEN = {
  address: "0x0A8C4a30716Cecd8739fc43A73F2881e1309Af24" as `0x${string}`,
  symbol: "MATCH",
  decimals: 18,
  name: "Match Token",
} as const;

// MTK Token details (legacy - keeping for backward compatibility)
export const MTK_TOKEN = {
  address: "0x0A8C4a30716Cecd8739fc43A73F2881e1309Af24" as `0x${string}`,
  symbol: "MTK",
  decimals: 18,
  name: "Match Token",
} as const;

// Token types for selection
export type TokenOption = "ETH" | "MATCH";

// Token list for UI display
export const TOKEN_OPTIONS: { value: TokenOption; label: string }[] = [
  { value: "ETH", label: "ETH" },
  { value: "MATCH", label: "MATCH" },
];

// ERC20 approval ABI
export const ERC20_APPROVAL_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

// Zero address constant for ETH
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const; 