// app/api/eth-price/route.js

let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export async function GET() {
  const currentTime = Date.now();

  // Check if cached data is still valid
  if (cachedData && currentTime - lastFetchTime < CACHE_DURATION) {
    return new Response(JSON.stringify(cachedData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800", // Tell clients to cache for 30 minutes
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  try {
    // Fetch new data from CoinGecko
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch ETH price");
    }

    // Update cache
    cachedData = data;
    lastFetchTime = currentTime;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800", // Tell clients to cache for 30 minutes
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

export const runtime = "edge";
