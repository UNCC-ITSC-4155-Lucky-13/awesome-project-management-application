export const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type ScheduleChange = {
  startDate: Date;
  durationWeeks: number | null;
  previousSprintStartDate: Date | null;
};

export type Sprint = {
  sprintNumber: string;
  startDate: Date;
  /** Exclusive: the next sprint starts at this instant. */
  endDate: Date;
  daysRemaining: number;
};

/** Walk saved cadences in order, including shortened/extended transition sprints. */
export function calculateSprints(
  changes: ScheduleChange[],
  until: Date,
  now: Date,
): Sprint[] {
  const sprints: Sprint[] = [];
  let year = 0;
  let number = 0;
  for (const [index, change] of changes.entries()) {
    if (change.durationWeeks === null) continue;
    const next = changes[index + 1];
    let start = change.startDate.getTime();
    while (
      start < until.getTime() &&
      (!next || start < next.startDate.getTime())
    ) {
      let end = start + change.durationWeeks * WEEK;
      if (next) {
        end =
          next.previousSprintStartDate &&
          start >= next.previousSprintStartDate.getTime()
            ? next.startDate.getTime()
            : Math.min(end, next.startDate.getTime());
      }
      const startDate = new Date(start);
      const startYear = startDate.getUTCFullYear();
      number = startYear === year ? number + 1 : 1;
      year = startYear;
      sprints.push({
        sprintNumber: `${year}-${number}`,
        startDate,
        endDate: new Date(end),
        daysRemaining: Math.max(
          0,
          Math.ceil((end - Math.max(now.getTime(), start)) / DAY),
        ),
      });
      start = end;
    }
  }
  return sprints;
}

export function getCurrentSprint(sprints: Sprint[], now: Date) {
  return (
    sprints.find((sprint) => sprint.startDate <= now && now < sprint.endDate) ??
    null
  );
}

/** Enough future intervals for the default list, even for long sprint durations. */
export function scheduleHorizon(
  changes: ScheduleChange[],
  now: Date,
  year = now.getUTCFullYear(),
) {
  const weeks = Math.max(
    1,
    ...changes.map((change) => change.durationWeeks ?? 0),
  );
  return new Date(
    Math.max(Date.UTC(year + 1, 0, 1), now.getTime() + 8 * weeks * WEEK),
  );
}

export function cadenceBoundary(
  anchor: Date,
  durationWeeks: number,
  threshold: Date,
) {
  const span = durationWeeks * WEEK;
  return new Date(
    anchor.getTime() +
      Math.max(0, Math.ceil((threshold.getTime() - anchor.getTime()) / span)) *
        span,
  );
}

export function withSprint<T extends { sprintNumber: string | null }>(
  story: T,
  sprints: Sprint[],
) {
  return {
    ...story,
    sprint:
      sprints.find((sprint) => sprint.sprintNumber === story.sprintNumber) ??
      null,
  };
}
