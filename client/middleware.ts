import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applyRateLimit } from '@/lib/middleware/rate-limit';
import { applySecurityHeaders } from '@/lib/middleware/security-headers';

// List of public routes that don't require authentication
const publicRoutes = ["/", "/api"];

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl;

  // Apply security headers and rate limiting for API routes
  if (pathname.startsWith('/api')) {
    // In production, block access to test/debug endpoints
    if (process.env.NODE_ENV === 'production') {
      if (pathname.startsWith('/api/test-') || pathname.startsWith('/api/debug')) {
        return applySecurityHeaders(NextResponse.json({ error: 'Not found' }, { status: 404 }));
      }
    }

    const limited = applyRateLimit(request);
    if (limited) {
      return applySecurityHeaders(limited);
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Check if the path is in public routes
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow access to public routes regardless of authentication status
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, we'll let the client-side handle authentication
  // Privy handles authentication state on the client side
  // The useWalletGuard hook will handle redirects if needed
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Original matcher for non-API paths
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
    // Also run on API routes for headers and rate limiting
    "/api/:path*",
  ],
};
