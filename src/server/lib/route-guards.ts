/**
 * Public routes that do not require authentication.
 */
export const PUBLIC_ROUTES = ["/", "/login"] as const;

/**
 * Returns true if the given pathname is a public route, false otherwise.
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Returns true if the given pathname is a protected route, false otherwise.
 */
export function isProtectedRoute(pathname: string): boolean {
  return !isPublicRoute(pathname);
}

/**
 * Builds the /login redirect URL, preserving the user's intended destination
 * (including query parameters) in the callbackUrl query parameter.
 */
export function buildLoginRedirect(
  origin: string,
  pathname: string,
  search: string,
): URL {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return loginUrl;
}
