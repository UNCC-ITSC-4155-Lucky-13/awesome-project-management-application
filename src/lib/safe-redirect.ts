// Only allow same-site relative paths as post-login destinations.
export function safeCallbackPath(callbackUrl: string | undefined): string {
  if (
    !callbackUrl ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//") ||
    callbackUrl.startsWith("/\\")
  ) {
    return "/";
  }
  return callbackUrl;
}
