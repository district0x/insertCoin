import { NextRequest, NextResponse } from 'next/server';
import rateLimiter from '@/lib/utils/rate-limit';

export function applyRateLimit(request: NextRequest | Request): NextResponse | null {
    // Get client IP address
    const clientIp = getClientIP(request);

    // Check if request is allowed
    if (!rateLimiter.isAllowed(clientIp)) {
        const remainingTime = rateLimiter.getRemainingTime(clientIp);
        const retryAfter = Math.ceil(remainingTime / 1000);
        const isBlocked = rateLimiter.isBlocked(clientIp);
        const blockReason = rateLimiter.getBlockReason(clientIp);
        const remainingRequests = rateLimiter.getRemainingRequests(clientIp);

        // Create appropriate error response based on the reason
        if (isBlocked) {
            return NextResponse.json(
                {
                    error: 'IP address blocked',
                    message: blockReason || 'Too many requests from this IP address',
                    retryAfter: `${retryAfter} seconds`,
                    blocked: true,
                    blockReason: blockReason
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': retryAfter.toString(),
                        'X-RateLimit-Limit': '100',
                        'X-RateLimit-Window': '60 seconds',
                        'X-RateLimit-Blocked': 'true',
                        'X-RateLimit-BlockReason': blockReason || 'Rate limit exceeded'
                    }
                }
            );
        } else {
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                    message: 'Too many requests from this IP address',
                    retryAfter: `${retryAfter} seconds`,
                    remainingRequests: remainingRequests,
                    blocked: false
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': retryAfter.toString(),
                        'X-RateLimit-Limit': '100',
                        'X-RateLimit-Window': '60 seconds',
                        'X-RateLimit-Remaining': remainingRequests.toString(),
                        'X-RateLimit-Blocked': 'false'
                    }
                }
            );
        }
    }

    // Allowed: return null (handlers will continue)
    return null;
}

export function getClientIP(request: NextRequest | Request): string {
    const headers = (request as NextRequest).headers ?? (request as Request).headers;
    const getHeader = (key: string) => headers.get(key);

    const forwarded = getHeader('x-forwarded-for');
    const realIp = getHeader('x-real-ip');
    const cfConnectingIp = getHeader('cf-connecting-ip'); // Cloudflare

    // Priority order: Cloudflare > Real-IP > X-Forwarded-For > default
    if (cfConnectingIp) {
        return cfConnectingIp;
    }

    if (realIp) {
        return realIp;
    }

    if (forwarded) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded.split(',')[0].trim();
    }

    // Next.js Request doesn't expose socket; fall back to unknown
    return 'unknown';
}

/**
 * Get rate limit information for a specific IP
 * @param request - Next.js request object
 * @returns Rate limit information
 */
export function getRateLimitInfo(request: NextRequest) {
    const clientIp = getClientIP(request);
    const remainingRequests = rateLimiter.getRemainingRequests(clientIp);
    const remainingTime = rateLimiter.getRemainingTime(clientIp);
    const isBlocked = rateLimiter.isBlocked(clientIp);
    const blockReason = rateLimiter.getBlockReason(clientIp);

    return {
        ip: clientIp,
        remainingRequests,
        remainingTime,
        isBlocked,
        blockReason,
        limit: 100,
        windowMs: 60000
    };
}

/**
 * Check if an IP is currently blocked
 * @param request - Next.js request object
 * @returns True if IP is blocked
 */
export function isIPBlocked(request: NextRequest): boolean {
    const clientIp = getClientIP(request);
    return rateLimiter.isBlocked(clientIp);
}

/**
 * Get rate limit metrics (for admin/monitoring purposes)
 * @returns Rate limit metrics
 */
export function getRateLimitMetrics() {
    return rateLimiter.getMetrics();
}

/**
 * Manually block an IP address
 * @param ip - IP address to block
 * @param reason - Reason for blocking
 * @param durationMs - Duration to block (optional, uses default if not provided)
 */
export function blockIP(ip: string, reason: string, durationMs?: number): void {
    rateLimiter.blockIP(ip, reason, durationMs);
}

/**
 * Manually unblock an IP address
 * @param ip - IP address to unblock
 * @returns True if IP was unblocked, false if it wasn't blocked
 */
export function unblockIP(ip: string): boolean {
    return rateLimiter.unblockIP(ip);
}

/**
 * Get all currently blocked IPs
 * @returns Array of blocked IP information
 */
export function getBlockedIPs() {
    return rateLimiter.getBlockedIPs();
} 