import { useEffect, useState } from "react";

export function useEthPrice() {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch ETH price");
        }

        const data = await response.json();
        setEthPrice(data.ethereum.usd);
        setError(null);
      } catch (err) {
        console.error("Error fetching ETH price:", err);
        setError("Failed to fetch ETH price");
      } finally {
        setLoading(false);
      }
    };

    fetchEthPrice();

    // Refresh price every minute
    const interval = setInterval(fetchEthPrice, 60000);

    return () => clearInterval(interval);
  }, []);

  const convertUsdToEth = (usdAmount: number): bigint => {
    if (!ethPrice) return 0n;
    const ethAmount = usdAmount / ethPrice;
    // Convert to wei (18 decimal places)
    return BigInt(Math.floor(ethAmount * 1e18));
  };

  const convertEthToUsd = (ethAmount: bigint): number => {
    if (!ethPrice) return 0;
    const eth = Number(ethAmount) / 1e18;
    return eth * ethPrice;
  };

  return {
    ethPrice,
    loading,
    error,
    convertUsdToEth,
    convertEthToUsd,
  };
}
