import { describe, expect, it } from "vitest";

import {
  cadenceBoundary,
  calculateSprints,
  getCurrentSprint,
  scheduleHorizon,
  withSprint,
  type ScheduleChange,
} from "./sprints";
import { clashingSprintNumbers } from "./project-sprints";

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const initial: ScheduleChange = {
  startDate: date("2026-04-06"),
  durationWeeks: 2,
  previousSprintStartDate: null,
};
const now = date("2026-04-10");
const until = date("2026-05-15");

describe("sprint calculations", () => {
  it("returns full metadata, remaining whole UTC days, and exclusive ends", () => {
    const sprints = calculateSprints([initial], until, now);
    expect(sprints[0]).toEqual({
      sprintNumber: "2026-1",
      startDate: date("2026-04-06"),
      endDate: date("2026-04-20"),
      daysRemaining: 10,
    });
    expect(sprints[1]?.daysRemaining).toBe(14);
    expect(getCurrentSprint(sprints, date("2026-04-20"))?.sprintNumber).toBe(
      "2026-2",
    );
    expect(getCurrentSprint(sprints, date("2026-04-05"))).toBeNull();
    expect(getCurrentSprint(sprints, date("2027-01-01"))).toBeNull();
  });

  it("rounds partial remaining days up and clamps elapsed sprints to zero", () => {
    const sprints = calculateSprints(
      [initial],
      until,
      new Date("2026-04-20T12:00:00Z"),
    );
    expect(sprints[0]?.daysRemaining).toBe(0);
    expect(sprints[1]?.daysRemaining).toBe(14);
  });

  it("keeps a cross-year sprint's starting year and resets on the next start", () => {
    const sprints = calculateSprints(
      [{ ...initial, startDate: date("2026-12-28") }],
      date("2027-02-01"),
      date("2027-01-01"),
    );
    expect(
      sprints.map((sprint) => [
        sprint.sprintNumber,
        sprint.startDate.toISOString(),
        sprint.endDate.toISOString(),
      ]),
    ).toEqual([
      ["2026-1", "2026-12-28T00:00:00.000Z", "2027-01-11T00:00:00.000Z"],
      ["2027-1", "2027-01-11T00:00:00.000Z", "2027-01-25T00:00:00.000Z"],
      ["2027-2", "2027-01-25T00:00:00.000Z", "2027-02-08T00:00:00.000Z"],
    ]);
  });

  it.each([
    ["2026-04-16", "2026-04-30"],
    ["2026-04-30", "2026-05-14"],
  ])(
    "cuts or extends the current sprint to %s and continues numbering",
    (boundary, nextEnd) => {
      const changes = [
        initial,
        {
          startDate: date(boundary),
          durationWeeks: 2,
          previousSprintStartDate: initial.startDate,
        },
      ];
      const sprints = calculateSprints(changes, until, now);
      expect(sprints[0]?.endDate).toEqual(date(boundary));
      expect(sprints[1]).toMatchObject({
        sprintNumber: "2026-2",
        startDate: date(boundary),
        endDate: date(nextEnd),
      });
    },
  );

  it("preserves earlier intervals and counts through multiple cadence changes", () => {
    const changes = [
      initial,
      {
        startDate: date("2026-04-23"),
        durationWeeks: 1,
        previousSprintStartDate: date("2026-04-20"),
      },
      {
        startDate: date("2026-05-10"),
        durationWeeks: 3,
        previousSprintStartDate: date("2026-05-07"),
      },
    ];
    expect(
      calculateSprints(changes, until, now).map((sprint) => [
        sprint.sprintNumber,
        sprint.startDate.toISOString().slice(0, 10),
        sprint.endDate.toISOString().slice(0, 10),
      ]),
    ).toEqual([
      ["2026-1", "2026-04-06", "2026-04-20"],
      ["2026-2", "2026-04-20", "2026-04-23"],
      ["2026-3", "2026-04-23", "2026-04-30"],
      ["2026-4", "2026-04-30", "2026-05-07"],
      ["2026-5", "2026-05-07", "2026-05-10"],
      ["2026-6", "2026-05-10", "2026-05-31"],
    ]);
  });

  it("supports disabled gaps and keeps old dates when re-enabled", () => {
    const changes = [
      initial,
      {
        startDate: date("2026-04-10"),
        durationWeeks: null,
        previousSprintStartDate: initial.startDate,
      },
      {
        startDate: date("2026-04-20"),
        durationWeeks: 1,
        previousSprintStartDate: null,
      },
    ];
    const sprints = calculateSprints(changes, until, now);
    expect(sprints[0]?.endDate).toEqual(date("2026-04-10"));
    expect(sprints[1]?.sprintNumber).toBe("2026-2");
    expect(getCurrentSprint(sprints, date("2026-04-15"))).toBeNull();
    expect(calculateSprints([], until, now)).toEqual([]);
  });

  it("handles a transition without an explicit preceding sprint and leap days", () => {
    const changes = [
      { ...initial, startDate: date("2028-02-21") },
      { ...initial, startDate: date("2028-02-29"), durationWeeks: 1 },
    ];
    const sprints = calculateSprints(changes, date("2028-03-07"), now);
    expect(sprints[0]?.endDate).toEqual(date("2028-02-29"));
    expect(sprints[1]?.endDate).toEqual(date("2028-03-07"));
  });

  it("chooses new-cadence boundaries without backdating", () => {
    const anchor = date("2026-04-16");
    expect(cadenceBoundary(anchor, 2, now)).toEqual(anchor);
    expect(cadenceBoundary(anchor, 2, date("2026-04-20"))).toEqual(
      date("2026-04-30"),
    );
    expect(cadenceBoundary(anchor, 2, anchor)).toEqual(anchor);
  });

  it("has a bounded requested-year horizon plus enough surrounding sprints", () => {
    expect(scheduleHorizon([], now)).toEqual(date("2027-01-01"));
    expect(
      scheduleHorizon([{ ...initial, durationWeeks: null }], now, 2030),
    ).toEqual(date("2031-01-01"));
    expect(
      scheduleHorizon([{ ...initial, durationWeeks: 52 }], now).getTime(),
    ).toBeGreaterThan(date("2030-01-01").getTime());
  });

  it("attaches metadata directly to assigned stories and null for backlog", () => {
    const sprints = calculateSprints([initial], until, now);
    expect(
      withSprint({ sprintNumber: "2026-1", name: "Issue" }, sprints).sprint,
    ).toEqual(sprints[0]);
    expect(withSprint({ sprintNumber: null }, sprints).sprint).toBeNull();
  });

  it("clears the entire suffix after a removed number, including a later valid year", () => {
    const before = calculateSprints(
      [{ ...initial, startDate: date("2026-12-07"), durationWeeks: 1 }],
      date("2027-01-12"),
      now,
    );
    const after = calculateSprints(
      [{ ...initial, startDate: date("2026-12-07"), durationWeeks: 4 }],
      date("2027-01-12"),
      now,
    );
    expect(clashingSprintNumbers(before, after)).toEqual([
      "2026-2",
      "2026-3",
      "2026-4",
      "2027-1",
      "2027-2",
    ]);
    expect(clashingSprintNumbers(before, before)).toEqual([]);
  });
});
