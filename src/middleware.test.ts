import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/server/better-auth", () => ({
  auth: { api: { getSession } },
}));

import { config, middleware } from "./middleware";

beforeEach(() => {
  getSession.mockReset();
});

describe("protected route matcher", () => {
  it.each([
    "/project",
    "/project/demo",
    "/project/demo/sprints",
    "/project/demo/metrics",
    "/project/demo/views/person",
    "/project/demo/settings/project",
    "/project/demo/settings/members",
    "/project/demo.foo/settings/members",
  ])("protects %s", (pathname) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: `http://localhost:3000${pathname}`,
      }),
    ).toBe(true);
  });

  it.each([
    "/",
    "/login",
    "/api/auth/get-session",
    "/api/trpc/post.getLatest",
    "/_next/static/chunk.js",
    "/favicon.ico",
    "/projects/demo",
    "/project-other",
    "/dashboard",
  ])("does not intercept %s", (pathname) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: `http://localhost:3000${pathname}`,
      }),
    ).toBe(false);
  });
});

describe("session validation", () => {
  it.each([undefined, "better-auth.session_token=forged-token"])(
    "redirects an invalid session even if a cookie is present: %s",
    async (cookie) => {
      getSession.mockResolvedValue(null);
      const request = new NextRequest(
        "http://localhost:3000/project/demo/settings/members?label=one&label=two&q=hello%20world",
        { headers: cookie ? { cookie } : undefined },
      );

      const response = await middleware(request);

      expect(getSession).toHaveBeenCalledExactlyOnceWith({
        headers: request.headers,
      });
      expect(response.status).toBe(307);
      const destination = new URL(response.headers.get("location")!);
      expect(destination.pathname).toBe("/login");
      expect(destination.searchParams.get("callbackUrl")).toBe(
        "/project/demo/settings/members?label=one&label=two&q=hello%20world",
      );
    },
  );

  it("allows a session validated by Better Auth", async () => {
    getSession.mockResolvedValue({ user: { id: "signed-in-user" } });
    const response = await middleware(
      new NextRequest("http://localhost:3000/project/demo"),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});
