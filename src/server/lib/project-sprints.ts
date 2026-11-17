import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray, isNotNull, ne } from "drizzle-orm";

import type { db } from "@/server/db";
import {
  projectMembers,
  projects,
  sprintScheduleChanges,
  stories,
} from "@/server/db/schema";
import {
  cadenceBoundary,
  calculateSprints,
  DAY,
  getCurrentSprint,
  scheduleHorizon,
  type ScheduleChange,
  type Sprint,
} from "./sprints";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Project = typeof projects.$inferSelect;

export async function prepareProject(
  tx: Transaction,
  projectId: string,
  userId: string,
) {
  // Every sprint-related handler uses this transaction until its response is ready.
  const [authorized] = await tx
    .select({ project: projects, membership: projectMembers })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projectMembers.userId, userId)))
    .for("update", { of: projects });
  if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
  const { project, membership } = authorized;
  const now = new Date();
  const changes = await tx.query.sprintScheduleChanges.findMany({
    where: eq(sprintScheduleChanges.projectId, projectId),
    orderBy: asc(sprintScheduleChanges.startDate),
  });
  const sprints = calculateSprints(changes, scheduleHorizon(changes, now), now);
  const currentSprint = project.sprintStartDate
    ? getCurrentSprint(sprints, now)
    : null;
  if (currentSprint) {
    const ended = sprints
      .filter((sprint) => sprint.endDate <= now)
      .map((sprint) => sprint.sprintNumber);
    if (ended.length) {
      await tx
        .update(stories)
        .set({ sprintNumber: currentSprint.sprintNumber })
        .where(
          and(
            eq(stories.projectId, projectId),
            ne(stories.column, "done"),
            inArray(stories.sprintNumber, ended),
          ),
        );
    }
  }
  return { project, membership, changes, sprints, currentSprint, now };
}

export function validateSprint(
  sprintNumber: string | null | undefined,
  project: Project,
  sprints: Sprint[],
) {
  if (!sprintNumber) return;
  if (!project.sprintStartDate)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Sprints are disabled for this project",
    });
  if (!sprints.some((sprint) => sprint.sprintNumber === sprintNumber)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Sprint does not exist in this project's schedule",
    });
  }
}

/** Reopening or assigning an unfinished issue to an elapsed sprint catches up immediately. */
export function rolloverAssignment(
  sprintNumber: string | null | undefined,
  column: string,
  sprints: Sprint[],
  current: Sprint | null,
  now: Date,
) {
  const assigned = sprints.find(
    (sprint) => sprint.sprintNumber === sprintNumber,
  );
  return column !== "done" && assigned && assigned.endDate <= now && current
    ? current.sprintNumber
    : sprintNumber;
}

/** Return the first old interval whose number disappeared, and all assignments after it. */
export function clashingSprintNumbers(before: Sprint[], after: Sprint[]) {
  const existing = new Set(after.map((sprint) => sprint.sprintNumber));
  const first = before.find((sprint) => !existing.has(sprint.sprintNumber));
  return first
    ? before
        .filter((sprint) => sprint.startDate >= first.startDate)
        .map((sprint) => sprint.sprintNumber)
    : [];
}

export async function changeSchedule(
  tx: Transaction,
  project: Project,
  changes: ScheduleChange[],
  settings: { sprintStartDate?: Date | null; sprintDuration?: number },
  applyTo: "current" | "next" | undefined,
  now: Date,
) {
  const anchor =
    settings.sprintStartDate === undefined
      ? project.sprintStartDate
      : settings.sprintStartDate;
  const duration = settings.sprintDuration ?? project.sprintDuration;
  const mode = applyTo ?? "current";
  if (
    settings.sprintStartDate === undefined &&
    settings.sprintDuration === undefined
  )
    return;
  if (
    anchor?.getTime() === project.sprintStartDate?.getTime() &&
    duration === project.sprintDuration &&
    (applyTo === undefined || !changes.some((change) => change.startDate > now))
  )
    return;
  if (!anchor && !project.sprintStartDate) return;
  // Replace pending rules while preserving already elapsed intervals.
  const elapsed = changes.filter((change) => change.startDate <= now);
  const oldSprints = calculateSprints(
    changes,
    scheduleHorizon(changes, now),
    now,
  );
  const current = getCurrentSprint(oldSprints, now);
  let startDate = anchor;
  if (anchor && current) {
    const activeRule = elapsed
      .filter((change) => change.startDate <= current.startDate)
      .at(-1)!;
    const originalEnd = new Date(
      current.startDate.getTime() + activeRule.durationWeeks! * 7 * 86_400_000,
    );
    const threshold =
      mode === "next"
        ? new Date(Math.max(originalEnd.getTime(), now.getTime()))
        : new Date(Math.max(now.getTime(), current.startDate.getTime() + 1));
    startDate = cadenceBoundary(anchor, duration, threshold);
    if (
      mode === "current" &&
      startDate.getTime() >
        Math.max(originalEnd.getTime(), current.endDate.getTime())
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "No new-cadence boundary remains in the current sprint. Apply to next instead.",
      });
    }
  } else if (anchor && elapsed.length && anchor < now) {
    // Today's date is eligible, but never backdate across the last effective change.
    const earliest = new Date(
      Math.max(
        Math.floor(now.getTime() / DAY) * DAY,
        elapsed.at(-1)!.startDate.getTime(),
      ),
    );
    startDate = cadenceBoundary(anchor, duration, earliest);
  }
  await tx
    .delete(sprintScheduleChanges)
    .where(
      and(
        eq(sprintScheduleChanges.projectId, project.id),
        gt(sprintScheduleChanges.startDate, now),
      ),
    );
  const change = {
    projectId: project.id,
    startDate: startDate ?? now,
    durationWeeks: anchor ? duration : null,
    previousSprintStartDate: current?.startDate ?? null,
  };
  await tx
    .insert(sprintScheduleChanges)
    .values(change)
    .onConflictDoUpdate({
      target: [
        sprintScheduleChanges.projectId,
        sprintScheduleChanges.startDate,
      ],
      set: { durationWeeks: change.durationWeeks },
    });
  if (!anchor) {
    await tx
      .update(stories)
      .set({ sprintNumber: null })
      .where(eq(stories.projectId, project.id));
  } else {
    const assigned = await tx
      .select({ sprintNumber: stories.sprintNumber })
      .from(stories)
      .where(
        and(eq(stories.projectId, project.id), isNotNull(stories.sprintNumber)),
      );
    const year = Math.max(
      now.getUTCFullYear(),
      ...assigned.map((story) => Number(story.sprintNumber!.slice(0, 4))),
    );
    const afterChanges = await tx.query.sprintScheduleChanges.findMany({
      where: eq(sprintScheduleChanges.projectId, project.id),
      orderBy: asc(sprintScheduleChanges.startDate),
    });
    const horizon = new Date(Date.UTC(year + 1, 0, 1));
    const before = calculateSprints(changes, horizon, now);
    const after = calculateSprints(afterChanges, horizon, now);
    const cleared = clashingSprintNumbers(before, after);
    if (cleared.length)
      await tx
        .update(stories)
        .set({ sprintNumber: null })
        .where(
          and(
            eq(stories.projectId, project.id),
            inArray(stories.sprintNumber, cleared),
          ),
        );
  }
}
