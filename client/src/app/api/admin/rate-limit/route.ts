import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitMetrics, getBlockedIPs, blockIP, unblockIP } from '@/lib/middleware/rate-limit';
import { createSecureApiResponse } from '@/lib/middleware/security-headers';
import { validateRequestBody } from '@/lib/middleware/validation';
import { z } from 'zod';

// Admin API key validation schema
const adminApiKeySchema = z.object({
    apiKey: z.string().min(32, 'API key must be at least 32 characters')
});

function timingSafeEqual(a: string, b: string) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

function isAuthorized(authHeader: string | null): boolean {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    const provided = authHeader.replace('Bearer ', '');
    const expected = process.env.ADMIN_API_KEY;
    if (expected && expected.length >= 32) {
        return timingSafeEqual(provided, expected);
    }
    // Fallback to legacy length check when no ADMIN_API_KEY set
    return provided.length >= 32;
}

// GET /api/admin/rate-limit - Get rate limit metrics
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!isAuthorized(authHeader)) {
            return createSecureApiResponse(
                { error: 'Unauthorized', message: 'Admin API key required' },
                { status: 401 }
            );
        }

        const metrics = getRateLimitMetrics();
        const blockedIPs = getBlockedIPs();

        return createSecureApiResponse({
            success: true,
            timestamp: new Date().toISOString(),
            metrics: {
                ...metrics,
                blockedIPsCount: blockedIPs.length
            },
            blockedIPs: blockedIPs.map(ip => ({
                ip: ip.identifier,
                reason: ip.reason,
                remainingTime: ip.remainingTime,
                blockedUntil: new Date(Date.now() + ip.remainingTime).toISOString()
            }))
        });

    } catch (error) {
        console.error('[ADMIN-RATE-LIMIT] Error:', error);
        return createSecureApiResponse(
            {
                error: 'Internal server error',
                message: 'Failed to retrieve rate limit metrics'
            },
            { status: 500 }
        );
    }
}

// POST /api/admin/rate-limit - Block an IP address
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!isAuthorized(authHeader)) {
            return createSecureApiResponse(
                { error: 'Unauthorized', message: 'Admin API key required' },
                { status: 401 }
            );
        }

        // Validate request body
        const bodyValidation = await validateRequestBody(request, z.object({
            ip: z.string().ip('Invalid IP address'),
            reason: z.string().min(1, 'Reason is required'),
            durationMs: z.number().optional()
        }));
        if (!bodyValidation.success) {
            return bodyValidation.response;
        }

        const { ip, reason, durationMs } = bodyValidation.data;
        blockIP(ip, reason, durationMs);

        console.log(`[ADMIN] IP ${ip} blocked: ${reason}`);

        return createSecureApiResponse({
            success: true,
            message: `IP ${ip} has been blocked`,
            ip,
            reason,
            durationMs: durationMs || 'default',
            blockedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ADMIN-RATE-LIMIT] Error blocking IP:', error);
        return createSecureApiResponse(
            {
                error: 'Internal server error',
                message: 'Failed to block IP address'
            },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/rate-limit - Unblock an IP address
export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!isAuthorized(authHeader)) {
            return createSecureApiResponse(
                { error: 'Unauthorized', message: 'Admin API key required' },
                { status: 401 }
            );
        }

        // Validate request body
        const bodyValidation = await validateRequestBody(request, z.object({
            ip: z.string().ip('Invalid IP address')
        }));
        if (!bodyValidation.success) {
            return bodyValidation.response;
        }

        const { ip } = bodyValidation.data;

        const wasUnblocked = unblockIP(ip);
        if (!wasUnblocked) {
            return createSecureApiResponse(
                {
                    error: 'Not found',
                    message: `IP ${ip} was not blocked`
                },
                { status: 404 }
            );
        }

        console.log(`[ADMIN] IP ${ip} unblocked`);

        return createSecureApiResponse({
            success: true,
            message: `IP ${ip} has been unblocked`,
            ip,
            unblockedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ADMIN-RATE-LIMIT] Error unblocking IP:', error);
        return createSecureApiResponse(
            {
                error: 'Internal server error',
                message: 'Failed to unblock IP address'
            },
            { status: 500 }
        );
    }
}

// OPTIONS - Handle preflight request
export async function OPTIONS(request: NextRequest) {
    return createSecureApiResponse(null, { status: 200 });
} 