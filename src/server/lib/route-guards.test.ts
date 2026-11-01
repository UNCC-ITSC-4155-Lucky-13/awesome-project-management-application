import { describe, expect, it } from "vitest";

import {
  buildLoginRedirect,
  isProtectedRoute,
  isPublicRoute,
} from "./route-guards";

describe("isPublicRoute", () => {
  it.each(["/", "/login", "/login/foo"])("returns true for %s", (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it.each([
    "/projects",
    "/projects/123",
    "/projects/123/boards",
    "/projects/123/boards/abc",
    "/projects/123/settings",
    "/dashboard",
  ])("returns false for %s", (path) => {
    expect(isPublicRoute(path)).toBe(false);
  });
});

describe("isProtectedRoute", () => {
  it.each([
    "/projects",
    "/projects/123",
    "/projects/123/boards",
    "/projects/123/settings",
    "/dashboard",
    "/settings/profile",
  ])("returns true for %s", (path) => {
    expect(isProtectedRoute(path)).toBe(true);
  });

  it.each(["/", "/login", "/login/foo"])("returns false for %s", (path) => {
    expect(isProtectedRoute(path)).toBe(false);
  });
});

describe("buildLoginRedirect", () => {
  it("preserves the intended pathname", () => {
    const url = buildLoginRedirect(
      "http://localhost:3000",
      "/projects/123",
      "",
    );
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe("/projects/123");
  });

  it("preserves query strings", () => {
    const url = buildLoginRedirect(
      "http://localhost:3000",
      "/projects/123/boards",
      "?tab=active",
    );
    expect(url.searchParams.get("callbackUrl")).toBe(
      "/projects/123/boards?tab=active",
    );
  });

  it("encodes special characters correctly", () => {
    const url = buildLoginRedirect(
      "http://localhost:3000",
      "/projects",
      "?q=hello world",
    );
    expect(url.searchParams.get("callbackUrl")).toBe("/projects?q=hello world");
  });
});
