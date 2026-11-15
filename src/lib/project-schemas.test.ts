import { describe, expect, it } from "vitest";

import { projectDetailsSchema, sprintSetupSchema } from "./project-schemas";

describe("projectDetailsSchema", () => {
  it("trims the name", () => {
    expect(
      projectDetailsSchema.parse({ name: "  Apollo  ", description: "" }).name,
    ).toBe("Apollo");
  });

  it.each(["", "   ", "x".repeat(256)])("rejects name %j", (name) => {
    expect(
      projectDetailsSchema.safeParse({ name, description: "" }).success,
    ).toBe(false);
  });

  it("accepts a 255 character name", () => {
    expect(
      projectDetailsSchema.safeParse({ name: "x".repeat(255), description: "" })
        .success,
    ).toBe(true);
  });
});

describe("sprintSetupSchema", () => {
  it("accepts disabled sprints without a date", () => {
    expect(sprintSetupSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it("accepts a start date and positive whole-week duration", () => {
    expect(
      sprintSetupSchema.safeParse({
        enabled: true,
        startDate: "2026-11-09",
        durationWeeks: 2,
      }).success,
    ).toBe(true);
  });

  it.each([
    { startDate: "", durationWeeks: 2 },
    { startDate: "2026-13-45", durationWeeks: 2 },
    { startDate: "2026-11-09", durationWeeks: 0 },
    { startDate: "2026-11-09", durationWeeks: -1 },
    { startDate: "2026-11-09", durationWeeks: 1.5 },
    { startDate: "2026-11-09", durationWeeks: Number.NaN },
  ])("rejects enabled sprints with %j", (rest) => {
    expect(
      sprintSetupSchema.safeParse({ enabled: true, ...rest }).success,
    ).toBe(false);
  });
});
