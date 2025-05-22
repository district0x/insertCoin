import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ethers } from 'ethers';

// Increase rate limit for development environment
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 30; // 30 requests per minute (increased)
const DEVELOPMENT_ENV = process.env.NODE_ENV === 'development';

// Store IP-based request counts with better memory management
const requestCounts = new Map();

// Periodically clean up expired rate limit entries to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requestCounts.entries()) {
        if (now > data.resetTime) {
            requestCounts.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW);

// Get the most reliable client IP from various headers
function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

// Check if the request should be rate limited
function checkRateLimit(request: NextRequest): { allowed: boolean, headers: HeadersInit } {
    // Skip rate limiting in development mode if needed
    if (DEVELOPMENT_ENV && request.headers.get('x-skip-rate-limit') === 'true') {
        return {
            allowed: true,
            headers: {
                'X-RateLimit-Limit': MAX_REQUESTS.toString(),
                'X-RateLimit-Remaining': MAX_REQUESTS.toString(),
                'X-RateLimit-Reset': '0'
            }
        };
    }

    const ip = getClientIp(request);
    const now = Date.now();
    const rateInfo = requestCounts.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

    // Reset count if the time window has passed
    if (now > rateInfo.resetTime) {
        rateInfo.count = 0;
        rateInfo.resetTime = now + RATE_LIMIT_WINDOW;
    }

    // Increment the request count
    rateInfo.count++;
    requestCounts.set(ip, rateInfo);

    // Calculate remaining requests and time to reset
    const remaining = Math.max(0, MAX_REQUESTS - rateInfo.count);
    const retryAfter = Math.ceil((rateInfo.resetTime - now) / 1000);

    // Build response headers with rate limit info
    const headers: HeadersInit = {
        'X-RateLimit-Limit': MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': retryAfter.toString(),
        'Cache-Control': 'no-store, must-revalidate'
    };

    // If limit exceeded, add Retry-After header
    if (rateInfo.count > MAX_REQUESTS) {
        headers['Retry-After'] = retryAfter.toString();
        return { allowed: false, headers };
    }

    return { allowed: true, headers };
}

// Generate a UUID compatible with Supabase
function generateUUID() {
    // Use the built-in crypto.randomUUID() if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback to a simple implementation if crypto.randomUUID is not available
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export async function POST(request: NextRequest) {
    // Apply rate limiting
    const { allowed, headers } = checkRateLimit(request);

    if (!allowed) {
        return new NextResponse(
            JSON.stringify({ error: 'Too many requests', retryAfter: headers['Retry-After'] }),
            {
                status: 429,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    try {
        const data = await request.json();
        console.log("Tournament API received data:", data);

        // Validate required fields
        if (!data.roomCode || !data.tournamentId || !data.maxParticipants) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400, headers }
            );
        }

        // Format entry fee for storage - ensure it's a string
        let entryFeeWei = data.entryFee;
        let entryFeeEth = "0";

        try {
            // If the entry fee is already in wei (large number), just store it as is
            if (data.entryFee && data.entryFee.toString().length > 10) {
                entryFeeWei = data.entryFee.toString();
                entryFeeEth = ethers.utils.formatEther(entryFeeWei);
            } else {
                // If it's a decimal (like "0.01"), convert to wei
                entryFeeWei = ethers.utils.parseEther(data.entryFee).toString();
                entryFeeEth = data.entryFee;
            }
        } catch (err) {
            console.error("Error parsing entry fee:", err);
            // If parsing fails, just store as string and handle the error gracefully
            entryFeeWei = data.entryFee.toString();
            entryFeeEth = data.entryFee.toString();
        }

        // Calculate total prize based on entry fee and max participants
        const totalPrize = parseFloat(entryFeeEth) * data.maxParticipants;

        // Generate a UUID for the id column - CRITICAL for Supabase tables with UUID primary keys
        const uuid = generateUUID();
        console.log("Generated UUID for new tournament:", uuid);

        // Get current timestamp for created/updated fields
        const now = new Date().toISOString();

        // Insert tournament data with admin client
        const { data: insertedData, error } = await supabaseAdmin
            .from('Tournament')
            .insert([
                {
                    id: uuid, // Provide the UUID for the id column
                    roomCode: data.roomCode,
                    tournamentId: data.tournamentId.toString(),
                    entryFee: entryFeeWei,
                    tokenAddress: data.tokenAddress || "0x0000000000000000000000000000000000000000",
                    maxParticipants: data.maxParticipants,
                    totalPrize: totalPrize,
                    status: 'FILLING',
                    createdAt: now,
                    updatedAt: now // Add the updatedAt timestamp
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: `Database error: ${error.message}` },
                { status: 500, headers }
            );
        }

        console.log("Tournament created successfully with ID:", insertedData?.id);

        // Set cache-related headers to prevent stale data
        const responseHeaders = {
            ...headers,
            'Cache-Control': 'no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        return NextResponse.json(
            {
                success: true,
                tournamentId: data.tournamentId,
                tournament: insertedData,
                entryFeeEth,
                totalPrize
            },
            { headers: responseHeaders }
        );
    } catch (error: any) {
        console.error('Server error:', error);
        return NextResponse.json(
            { error: `Server error: ${error.message}` },
            { status: 500, headers }
        );
    }
}

export async function GET(request: NextRequest) {
    // Apply rate limiting
    const { allowed, headers } = checkRateLimit(request);

    if (!allowed) {
        return new NextResponse(
            JSON.stringify({ error: 'Too many requests', retryAfter: headers['Retry-After'] }),
            {
                status: 429,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    try {
        // Get active tournaments for display
        const { data: tournaments, error } = await supabaseAdmin
            .from('Tournament')
            .select('*')
            .in('status', ['ACTIVE', 'FILLING'])
            .order('createdAt', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: `Database error: ${error.message}` },
                { status: 500, headers }
            );
        }

        // Format the entry fee for display
        const formattedTournaments = tournaments?.map(t => {
            try {
                // If the entry fee is a large number (wei), format it to ETH
                if (t.entryFee && t.entryFee.toString().length > 10) {
                    return {
                        ...t,
                        entryFeeFormatted: ethers.utils.formatEther(t.entryFee)
                    };
                }
                return t;
            } catch (err) {
                return t;
            }
        });

        // Set cache-related headers to prevent stale data
        const responseHeaders = {
            ...headers,
            'Cache-Control': 'max-age=5', // Allow caching for 5 seconds
            'Surrogate-Control': 'max-age=5'
        };

        return NextResponse.json(
            { tournaments: formattedTournaments },
            { headers: responseHeaders }
        );
    } catch (error: any) {
        console.error('Server error:', error);
        return NextResponse.json(
            { error: `Server error: ${error.message}` },
            { status: 500, headers }
        );
    }
}