import { NextResponse } from 'next/server';

// Cache ETH price for 5 minutes to reduce API calls
let cachedPrice = 3500;
let lastUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    try {
        const now = Date.now();

        // Return cached price if it's still valid
        if (now - lastUpdate < CACHE_DURATION) {
            return NextResponse.json({
                price: cachedPrice,
                cached: true,
                lastUpdate: new Date(lastUpdate).toISOString()
            });
        }

        // Try CoinGecko first (most reliable)
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
                headers: {
                    'Accept': 'application/json',
                },
                next: { revalidate: 300 } // Cache for 5 minutes
            });

            if (res.ok) {
                const data = await res.json();
                if (data.ethereum && data.ethereum.usd) {
                    cachedPrice = data.ethereum.usd;
                    lastUpdate = now;

                    return NextResponse.json({
                        price: cachedPrice,
                        source: 'coingecko',
                        cached: false,
                        lastUpdate: new Date(lastUpdate).toISOString()
                    });
                }
            }
        } catch (error) {
            console.log('CoinGecko failed, trying Binance...');
        }

        // Fallback to Binance
        try {
            const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', {
                headers: {
                    'Accept': 'application/json',
                },
                next: { revalidate: 300 }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.price) {
                    cachedPrice = parseFloat(data.price);
                    lastUpdate = now;

                    return NextResponse.json({
                        price: cachedPrice,
                        source: 'binance',
                        cached: false,
                        lastUpdate: new Date(lastUpdate).toISOString()
                    });
                }
            }
        } catch (error) {
            console.log('Binance failed, using cached value...');
        }

        // Return cached price as fallback
        return NextResponse.json({
            price: cachedPrice,
            source: 'cached',
            cached: true,
            lastUpdate: new Date(lastUpdate).toISOString(),
            warning: 'Using cached price - live data unavailable'
        });

    } catch (error) {
        console.error('Error fetching ETH price:', error);

        // Return cached price as final fallback
        return NextResponse.json({
            price: cachedPrice,
            source: 'fallback',
            cached: true,
            lastUpdate: new Date(lastUpdate).toISOString(),
            error: 'Failed to fetch current ETH price'
        });
    }
} 