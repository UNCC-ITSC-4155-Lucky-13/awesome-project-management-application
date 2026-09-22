import { describe, expect, it } from 'vitest';

import {
    buildLoginRedirect,
    isProtectedRoute,
    isPublicRoute,
} from "./route-guards";

describe("isProtectedRoute", () => {
    it.each([
        "/dashboard",
        "/dashboard/settings",
        "/projects",
        "/projects/123",
        "/boards",
        "/boards/abc",
        "/settings",
        "/settings/profile",
    ])("returns true for %s", (path) => {
        expect(isProtectedRoute(path)).toBe(true);
    });

    it.each(["/", "/login", "/about", "/public-page", "/dashboardx"])(
        "returns false for %s",
        (path) => {
            expect(isProtectedRoute(path)).toBe(false);
        },
    );
});

describe("isPublicRoute", () => {
    it.each(["/", "/login", "/login/foo"])("returns true for %s", (path) => {
        expect(isPublicRoute(path)).toBe(true);
    });
    
    it.each(["/dashboard", "/projects", "/settings"])(
        "returns false for %s",
        (path) => {
            expect(isPublicRoute(path)).toBe(false);
        },
    );
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
            "/boards",
            "?tab=active",
        );
        expect(url.searchParams.get("callbackUrl")).toBe("/boards?tab=active");
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