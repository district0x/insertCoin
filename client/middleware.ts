import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// List of public routes that don't require wallet connection
const publicRoutes = ["/", "/api"];

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl;

  // Check if the path is in public routes
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Get the wallet connection status from cookies
  const hasWallet = request.cookies.get("wagmi.connected")?.value === "true";

  // Allow access to public routes regardless of wallet status
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If wallet is not connected and trying to access protected route, redirect to home
  if (!hasWallet) {
    const url = new URL("/", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
