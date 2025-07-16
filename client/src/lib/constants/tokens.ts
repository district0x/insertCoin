// Token constants for the application

// MTK Token details
export const MTK_TOKEN = {
  address: "0x29Cf44155892ba0A811daace8a45dba4205df2Fb" as `0x${string}`,
  symbol: "MTK",
  decimals: 18,
  name: "Match Token",
} as const;

// Token types for selection
export type TokenOption = "ETH" | "MTK";

// Token list for UI display
export const TOKEN_OPTIONS: { value: TokenOption; label: string }[] = [
  { value: "ETH", label: "ETH" },
  { value: "MTK", label: "MTK" },
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