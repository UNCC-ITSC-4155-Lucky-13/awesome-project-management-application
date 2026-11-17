import { describe, expect, it } from "vitest";

import { formatSprintLabel } from "./sprint";

describe("formatSprintLabel", () => {
  it("formats a sprint tag", () => {
    expect(formatSprintLabel("2026-4")).toBe("Sprint 4, 2026");
  });

  it("drops leading zeros from the sprint number", () => {
    expect(formatSprintLabel("2026-04")).toBe("Sprint 4, 2026");
  });

  it.each(["", "2026", "26-4", "2026-", "2026-4a", "Sprint 4"])(
    "returns null for %j",
    (value) => {
      expect(formatSprintLabel(value)).toBeNull();
    },
  );
});
