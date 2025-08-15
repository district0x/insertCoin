import { useEffect, useState } from "react";

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
const LOCALSTORAGE_KEY = "ethPrice";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface CachedPrice {
  price: number;
  timestamp: number;
}

// In-memory cache
let memoryCache: CachedPrice | null = null;

function isValidCache(cache: CachedPrice | null): cache is CachedPrice {
  if (!cache) return false;
  const now = Date.now();
  return now - cache.timestamp < CACHE_DURATION;
}

async function fetchLatestPrice(): Promise<number> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );

  if (!response.ok) {
    throw new Error("Failed to fetch ETH price");
  }

  const data = await response.json();
  return data.ethereum.usd;
}

export function useEthPrice() {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updatePrice = async () => {
      try {
        // Check memory cache first
        if (isValidCache(memoryCache)) {
          setEthPrice(memoryCache.price);
          setLoading(false);
          return;
        }

        // Check localStorage cache
        const cachedData = localStorage.getItem(LOCALSTORAGE_KEY);
        if (cachedData) {
          const cache = JSON.parse(cachedData) as CachedPrice;
          if (isValidCache(cache)) {
            setEthPrice(cache.price);
            memoryCache = cache; // Update memory cache
            setLoading(false);
            return;
          }
        }

        // Fetch new price if cache is invalid or missing
        const price = await fetchLatestPrice();
        const newCache: CachedPrice = {
          price,
          timestamp: Date.now(),
        };

        // Update caches
        memoryCache = newCache;
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(newCache));

        setEthPrice(price);
        setError(null);
      } catch (err) {
        // If we have any cached price, use it as fallback even if expired
        const fallbackPrice =
          memoryCache?.price ||
          (localStorage.getItem(LOCALSTORAGE_KEY)
            ? JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY)!).price
            : null);

        if (fallbackPrice !== null) {
          setEthPrice(fallbackPrice);
          setError("Using cached price - failed to fetch latest");
        } else {
          setError("Failed to fetch ETH price");
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial update
    updatePrice();

    // Set up periodic updates
    const interval = setInterval(updatePrice, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const convertUsdToEth = (usdAmount: number): bigint => {
    if (!ethPrice || ethPrice <= 0 || usdAmount <= 0) return 0n;

    try {
      const MAX_ETH_AMOUNT = 1000000n * 10n ** 18n;
      const ethAmount = usdAmount / ethPrice;
      if (!isFinite(ethAmount)) {
        return 0n;
      }
      let weiAmount: bigint;
      try {
        const ethAmountScaled = ethAmount * 1e18;
        if (ethAmountScaled > Number.MAX_SAFE_INTEGER) {
          weiAmount = MAX_ETH_AMOUNT;
        } else {
          weiAmount = BigInt(Math.round(ethAmountScaled));
        }
      } catch {
        return 0n;
      }
      if (weiAmount > MAX_ETH_AMOUNT) {
        return MAX_ETH_AMOUNT;
      }
      if (weiAmount === 0n && usdAmount > 0) {
        return 0n;
      }
      return weiAmount;
    } catch {
      return 0n;
    }
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
    convertEthToUsd
  };
}
