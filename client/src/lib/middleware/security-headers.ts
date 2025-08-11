import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers configuration (environment-aware)
 */
const isProduction = process.env.NODE_ENV === 'production';

const cspDirectives: string[] = [
    "default-src 'self'",
    // Scripts: tighten in production (no inline/eval). Allow dev tools in development.
    isProduction
        ? "script-src 'self'"
        : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://vercel.com",
    // Styles: allow inline for Tailwind/runtime styles. Can be tightened later with nonces/hashes.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    // Connect: allow WS/HTTP in dev for local, HTTPS/WSS in production
    isProduction
        ? "connect-src 'self' https: wss:"
        : "connect-src 'self' http: https: ws: wss:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
];

const securityHeaders: Record<string, string> = {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Enable basic XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Content Security Policy
    'Content-Security-Policy': cspDirectives.join('; '),

    // Permissions Policy
    'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()'
    ].join(', '),

    // Cross-Origin Resource Policy
    'Cross-Origin-Resource-Policy': 'same-site',

    // Cross-Origin Opener Policy
    'Cross-Origin-Opener-Policy': 'same-origin',

    // Cross-Origin Embedder Policy
    'Cross-Origin-Embedder-Policy': 'require-corp',
};

// Only add HSTS in production (served over HTTPS)
if (isProduction) {
    securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
}

/**
 * Apply security headers to a response
 * @param response - Next.js response object
 * @returns Response with security headers
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
}

/**
 * Create a response with security headers
 */
export function createSecureResponse(
    body: any,
    options?: {
        status?: number;
        headers?: Record<string, string>;
    }
): NextResponse {
    const response = NextResponse.json(body, options);
    return applySecurityHeaders(response);
}

/**
 * Security headers middleware for API routes
 */
export async function withSecurityHeaders(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
    try {
        const response = await handler(request);
        return applySecurityHeaders(response);
    } catch (error) {
        console.error('[SECURITY-HEADERS] Error in API handler:', error);

        const errorResponse = NextResponse.json(
            {
                error: 'Internal server error',
                message: 'An unexpected error occurred'
            },
            { status: 500 }
        );

        return applySecurityHeaders(errorResponse);
    }
}

/**
 * CORS configuration for API routes
 */
export const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production'
        ? 'https://yourdomain.com' // Replace with your actual domain
        : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true'
};

export function applyCorsHeaders(response: NextResponse): NextResponse {
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
}

export function handlePreflight(request: NextRequest): NextResponse {
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 200 });
        return applyCorsHeaders(response);
    }

    throw new Error('Not a preflight request');
}

export function createSecureApiResponse(
    body: any,
    options?: {
        status?: number;
        headers?: Record<string, string>;
    }
): NextResponse {
    const response = NextResponse.json(body, options);
    const withSecurity = applySecurityHeaders(response);
    return applyCorsHeaders(withSecurity);
} 