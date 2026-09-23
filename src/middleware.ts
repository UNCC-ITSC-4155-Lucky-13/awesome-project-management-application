import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import {
  buildLoginRedirect,
  isProtectedRoute,
  isPublicRoute,
} from "@/server/lib/route-guards";

export function middleware(request: NextRequest) {
  const { pathname, origin, search } = request.nextUrl;

  // Public routes are accessible without authentication.
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Only Protected routes require authentication.
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  // Cheap cookie check to see if the user is authenticated. If not, redirect to the login page.
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(buildLoginRedirect(origin, pathname, search));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API routes, and static files from the middleware.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
