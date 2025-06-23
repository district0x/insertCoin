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

// Helper function to format entry fee from WEI to ETH
function formatEntryFee(entryFee: string): string {
    try {
        // If the entry fee is already in ETH format (small number), return as is
        if (parseFloat(entryFee) < 1000000) {
            return entryFee;
        }

        // Convert from WEI to ETH
        const entryFeeBN = ethers.BigNumber.from(entryFee);
        return ethers.utils.formatEther(entryFeeBN);
    } catch (error) {
        console.error('Error formatting entry fee:', error);
        return entryFee; // Return original value if conversion fails
    }
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
        const body = await request.json();
        const { tournamentId, roomCode, entryFee, maxParticipants, tokenAddress } = body;

        // Validate entry fee is in WEI
        try {
            const entryFeeBN = ethers.BigNumber.from(entryFee);
            if (entryFeeBN.lt(0)) {
                return NextResponse.json(
                    { error: 'Entry fee must be a positive number' },
                    { status: 400, headers }
                );
            }
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid entry fee format. Must be a valid WEI amount as a string' },
                { status: 400, headers }
            );
        }

        // Validate required fields
        if (!roomCode || !tournamentId || !maxParticipants) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400, headers }
            );
        }

        // Calculate total prize based on entry fee and max participants
        // Convert entry fee from WEI to ETH for calculation
        const entryFeeInEth = parseFloat(ethers.utils.formatEther(entryFee));
        const totalPrize = entryFeeInEth * maxParticipants;

        // Generate a UUID for the id column
        const uuid = generateUUID();
        const now = new Date().toISOString();

        // Insert the tournament
        const { data, error } = await supabaseAdmin
            .from('Tournament')
            .insert([
                {
                    id: uuid,
                    roomCode,
                    tournamentId,
                    entryFee: entryFee.toString(), // Store as string in WEI
                    tokenAddress: tokenAddress || "0x0000000000000000000000000000000000000000",
                    maxParticipants,
                    totalPrize,
                    status: 'FILLING',
                    createdAt: now,
                    updatedAt: now
                }
            ])
            .select();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: `Database error: ${error.message}` },
                { status: 500, headers }
            );
        }

        const newTournament = data?.[0];

        console.log("Tournament created successfully with ID:", newTournament?.id);
        console.log("Full tournament data created:", newTournament);

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
                tournamentId,
                tournament: newTournament,
                entryFee,
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
        // Get query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const status = searchParams.get('status');
        const search = searchParams.get('search') || '';
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        // Calculate offset
        const offset = (page - 1) * limit;

        // Build query
        let query = supabaseAdmin
            .from('Tournament')
            .select('*', { count: 'exact' });

        // Apply filters
        if (status) {
            query = query.in('status', status.split(','));
        } else {
            // Show all tournaments including completed ones to see the latest matches
            query = query.in('status', ['ACTIVE', 'FILLING', 'COMPLETED']);
        }

        // Apply search if provided
        if (search) {
            query = query.or(`roomCode.ilike.%${search}%,tournamentId.ilike.%${search}%`);
        }

        // Apply sorting
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        // Execute query
        const { data: tournaments, error, count } = await query;

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: `Database error: ${error.message}` },
                { status: 500, headers }
            );
        }

        // Get participant counts for all tournaments
        const tournamentIds = tournaments?.map(t => t.tournamentId) || [];

        // Create a map to store participant counts
        const participantCountMap = new Map();

        // Get participant counts for each tournament
        for (const tournamentId of tournamentIds) {
            const { count: participantCount, error: countError } = await supabaseAdmin
                .from('TournamentParticipant')
                .select('*', { count: 'exact', head: true })
                .eq('tournamentid', tournamentId);

            if (countError) {
                console.error(`Error getting participant count for tournament ${tournamentId}:`, countError);
                participantCountMap.set(tournamentId, 0);
            } else {
                participantCountMap.set(tournamentId, participantCount || 0);
            }
        }

        // Format the entry fee and add participant count
        const formattedTournaments = tournaments?.map(t => {
            try {
                const currentParticipants = participantCountMap.get(t.tournamentId) || 0;
                const entryFeeFormatted = formatEntryFee(t.entryFee);

                return {
                    ...t,
                    entryFeeFormatted,
                    currentParticipants
                };
            } catch (err) {
                console.error('Error formatting tournament:', err);
                return t;
            }
        });

        // Get winner information for completed tournaments
        const tournamentsWithWinners = await Promise.all(
            formattedTournaments?.map(async (tournament) => {
                if (tournament.status === 'COMPLETED' && tournament.winnerAddresses) {
                    try {
                        // Get winner details from TournamentParticipant table
                        const { data: winners, error: winnersError } = await supabaseAdmin
                            .from('TournamentParticipant')
                            .select('name, walletaddress, winningrank')
                            .eq('tournamentid', tournament.tournamentId)
                            .in('walletaddress', tournament.winnerAddresses)
                            .order('winningrank', { ascending: true });

                        if (!winnersError && winners) {
                            return {
                                ...tournament,
                                winners: winners.map(winner => ({
                                    name: winner.name || 'Anonymous',
                                    address: winner.walletaddress,
                                    rank: winner.winningrank
                                }))
                            };
                        }
                    } catch (err) {
                        console.error(`Error fetching winners for tournament ${tournament.tournamentId}:`, err);
                    }
                }
                return tournament;
            }) || []
        );

        // Set cache-related headers to prevent stale data
        const responseHeaders = {
            ...headers,
            'Cache-Control': 'max-age=5', // Allow caching for 5 seconds
            'Surrogate-Control': 'max-age=5'
        };

        return NextResponse.json(
            {
                tournaments: tournamentsWithWinners,
                pagination: {
                    total: count || 0,
                    page,
                    limit,
                    totalPages: Math.ceil((count || 0) / limit)
                }
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