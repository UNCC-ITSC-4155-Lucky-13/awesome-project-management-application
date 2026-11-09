import { describe, expect, it } from "vitest";

import { safeCallbackPath } from "./safe-redirect";

describe("safeCallbackPath", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackPath("/project/abc?x=1")).toBe("/project/abc?x=1");
  });

  it.each([undefined, "", "https://evil.com", "//evil.com", "/\\evil.com"])(
    "falls back to / for %j",
    (value) => {
      expect(safeCallbackPath(value)).toBe("/");
    },
  );

  it("uses the supplied fallback when the destination is unsafe", () => {
    expect(safeCallbackPath("//evil.com", "/projects")).toBe("/projects");
    expect(safeCallbackPath(undefined, "/projects")).toBe("/projects");
  });
});
