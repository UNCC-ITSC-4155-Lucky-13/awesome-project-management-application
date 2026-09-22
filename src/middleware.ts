import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Routes that require authentication.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/boards", "/settings"];

/**
 * Public routes that do not require authentication.
 */
const PUBLIC_ROUTES = ["/", "/login"];

function isProtectedRoute(pathname: string): boolean {
    return PROTECTED_PREFIXES.some(
(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

function isPublicRoute(pathname: string): boolean {
    return PUBLIC_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Public routes are accessible without authentication.
    if (isPublicRoute(pathname)) {
        return NextResponse.next();
    }

    // Protected routes require authentication.
    if (!isProtectedRoute(pathname)) {
        return NextResponse.next();
    }

    // Cheap cookie check to see if the user is authenticated. If not, redirect to the login page.
    const sessionCookie = getSessionCookie(request);

    if (!sessionCookie) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    // Skip Next internals, API routes, and static files from the middleware.
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*\\..*).*)"],
};