// app/api/eth-price/route.js
// export const config = { runtime: "nodejs" }; // Uncomment if needed for server-side operations

export async function GET() {
  try {
    // Fetch the ETH price in USD from CoinGecko
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch ETH price");
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Allow CORS for all origins
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", // Allow these methods
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Allow CORS for all origins
      },
    });
  }
}
