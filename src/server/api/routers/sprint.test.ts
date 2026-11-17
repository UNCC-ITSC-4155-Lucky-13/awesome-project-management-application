import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { projectMiddleware } from "@/server/api/project-middleware";
import { projects, sprintScheduleChanges, stories } from "@/server/db/schema";
import type { Transaction } from "@/server/lib/project-sprints";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const api = createTestCaller();
async function project(start = "2026-04-06", duration = 2) {
  return api.project.create({
    name: "Sprints",
    settings: { sprintStartDate: date(start), sprintDuration: duration },
  });
}
function setSprintStart(
  projectId: string,
  start: string | null,
  applyTo?: "current" | "next",
) {
  return api.project.update({
    projectId,
    settings: { sprintStartDate: start === null ? null : date(start) },
    applyTo,
  });
}
async function seedStory(
  projectId: string,
  sprintNumber: string | null,
  column = "todo",
) {
  const [story] = await db
    .insert(stories)
    .values({
      projectId,
      sprintNumber,
      column,
      creatorId: testSession.user.id,
      name: `${sprintNumber}-${column}`,
      lastMovedAt: date("2026-01-01"),
    })
    .returning();
  return story!;
}

const readStory = (id: string) =>
  db.query.stories.findFirst({ where: eq(stories.id, id) });

async function holdProject(
  projectId: string,
  beforeWait?: (tx: Transaction) => Promise<unknown>,
) {
  let release!: () => void;
  let locked!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const holding = db.transaction(async (tx) => {
    await tx
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .for("update");
    await beforeWait?.(tx);
    locked();
    await gate;
  });
  await acquired;
  return async () => {
    release();
    await holding;
  };
}

describe("sprint API and blocking middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date("2026-04-10"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns dates on sprint, story, and project responses", async () => {
    const p = await project();
    const sprint = {
      sprintNumber: "2026-1",
      startDate: date("2026-04-06"),
      endDate: date("2026-04-20"),
      daysRemaining: 10,
    };
    expect(p.currentSprint).toEqual(sprint);
    expect(await api.sprint.getCurrentSprint({ projectId: p.id })).toEqual(
      sprint,
    );
    const created = await api.story.create({
      projectId: p.id,
      name: "Assigned",
      sprintNumber: "2026-1",
    });
    expect(created.sprint).toEqual(sprint);
    expect((await api.story.getById({ id: created.id })).sprint).toEqual(
      sprint,
    );
    expect(
      (await api.story.update({ id: created.id, name: "Renamed" })).sprint,
    ).toEqual(sprint);
    expect((await api.story.list({ projectId: p.id }))[0]?.sprint).toEqual(
      sprint,
    );
    expect(
      (await api.project.getById({ projectId: p.id })).currentSprint,
    ).toEqual(sprint);
    expect((await api.project.list())[0]?.currentSprint).toEqual(sprint);
  });

  it.each(["+02:00", "-04:00"])(
    "preserves the exact local-midnight instant from UTC%s",
    async (offset) => {
      const start = new Date(`2026-04-06T00:00:00${offset}`);
      const changedStart = new Date(`2026-04-16T00:00:00${offset}`);
      const p = await api.project.create({
        name: "Local calendar",
        settings: { sprintStartDate: start },
      });
      expect(p.currentSprint?.startDate).toEqual(start);
      const changed = await api.project.update({
        projectId: p.id,
        settings: { sprintStartDate: changedStart },
      });
      expect(changed.currentSprint?.endDate).toEqual(changedStart);
      expect(
        (await api.sprint.listSprints({ projectId: p.id }))[1]?.startDate,
      ).toEqual(changedStart);
    },
  );

  it("validates endpoint input before running rollover middleware", async () => {
    const p = await project();
    const overdue = await seedStory(p.id, "2026-1");
    vi.setSystemTime(date("2026-04-20"));
    const transaction = vi.spyOn(db, "transaction");
    try {
      await expect(
        api.story.create({ projectId: p.id, name: "" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(transaction).not.toHaveBeenCalled();
      expect(await readStory(overdue.id)).toMatchObject({
        sprintNumber: "2026-1",
      });
    } finally {
      transaction.mockRestore();
    }
  });

  it("returns surrounding ranges, supports zero counts and year filters", async () => {
    const p = await project("2026-01-05");
    const sprints = await api.sprint.listSprints({ projectId: p.id });
    expect(sprints).toHaveLength(10);
    expect(sprints[0]?.sprintNumber).toBe("2026-4");
    expect(sprints[3]?.sprintNumber).toBe("2026-7");
    expect(sprints[9]?.sprintNumber).toBe("2026-13");
    expect(
      await api.sprint.listSprints({
        projectId: p.id,
        pastCount: 0,
        futureCount: 0,
      }),
    ).toHaveLength(1);
    const year = await api.sprint.listSprints({
      projectId: p.id,
      year: 2027,
    });
    expect(year).toHaveLength(26);
    expect(year[0]).toMatchObject({
      sprintNumber: "2027-1",
      startDate: date("2027-01-04"),
    });
    expect(
      await api.sprint.listSprints({ projectId: p.id, year: 2025 }),
    ).toEqual([]);
    expect(
      await api.sprint.listSprints({ projectId: p.id, futureCount: 20 }),
    ).toHaveLength(24);
    await expect(
      api.sprint.listSprints({ projectId: p.id, pastCount: -1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each(["2026-05-04", "2030-01-07"])(
    "returns upcoming ranges before the first sprint on %s",
    async (start) => {
      const p = await project(start);
      expect(await api.sprint.getCurrentSprint({ projectId: p.id })).toBeNull();
      const sprints = await api.sprint.listSprints({ projectId: p.id });
      expect(sprints).toHaveLength(6);
      expect(sprints[0]?.startDate).toEqual(date(start));
    },
  );

  it("has no sprint data when disabled, but permits backlog create/clear", async () => {
    const p = await api.project.create({ name: "Disabled" });
    expect(await api.sprint.getCurrentSprint({ projectId: p.id })).toBeNull();
    expect(await api.sprint.listSprints({ projectId: p.id })).toEqual([]);
    const story = await api.story.create({
      projectId: p.id,
      name: "Backlog",
    });
    expect(story.sprint).toBeNull();
    expect(
      (await api.story.update({ id: story.id, sprintNumber: null })).sprint,
    ).toBeNull();
    const sprintNumber = "2026-1";
    await expect(
      api.story.create({
        projectId: p.id,
        name: "Invalid",
        sprintNumber,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      api.story.update({ id: story.id, sprintNumber }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects nonexistent sprint numbers while enabled and attaches far-future metadata", async () => {
    const p = await project();
    const story = await api.story.create({
      projectId: p.id,
      name: "Future",
      sprintNumber: "2030-1",
    });
    expect(story.sprint?.sprintNumber).toBe("2030-1");
    expect(
      (
        await api.story.getById({ id: story.id })
      ).sprint?.startDate.getUTCFullYear(),
    ).toBe(2030);
    expect(
      (await api.story.list({ projectId: p.id }))[0]?.sprint?.sprintNumber,
    ).toBe("2030-1");
    expect(
      (await api.story.update({ id: story.id, name: "Still future" })).sprint
        ?.sprintNumber,
    ).toBe("2030-1");
    await expect(
      api.story.create({
        projectId: p.id,
        name: "Invalid",
        sprintNumber: "2026-999",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      api.story.update({ id: story.id, sprintNumber: "2026-999" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each(["current", "next"] as const)(
    "applies the confirmed %s cadence boundary and rolls over when due",
    async (applyTo) => {
      const p = await project();
      const story = await seedStory(p.id, "2026-1", "in_progress");
      const updated = await setSprintStart(p.id, "2026-04-16", applyTo);
      const boundary = applyTo === "current" ? "2026-04-16" : "2026-04-30";
      expect(updated.currentSprint).toMatchObject({
        sprintNumber: "2026-1",
        endDate: date(boundary),
      });
      const ranges = await api.sprint.listSprints({ projectId: p.id });
      expect(ranges[1]?.startDate).toEqual(date(boundary));
      vi.setSystemTime(date(boundary));
      const fetched = await api.story.getById({ id: story.id });
      expect(fetched).toMatchObject({
        sprintNumber: "2026-2",
        column: "in_progress",
        lastMovedAt: date("2026-01-01"),
      });
      expect(fetched.sprint?.startDate).toEqual(date(boundary));
    },
  );

  it("defaults to current and replaces a pending change without duplicating numbers", async () => {
    const p = await project();
    await setSprintStart(p.id, "2026-04-16");
    const updated = await api.project.update({
      projectId: p.id,
      settings: { sprintStartDate: date("2026-04-17"), sprintDuration: 1 },
    });
    expect(updated.currentSprint?.endDate).toEqual(date("2026-04-17"));
    expect(await db.query.sprintScheduleChanges.findMany()).toHaveLength(2);
    const ranges = await api.sprint.listSprints({ projectId: p.id });
    expect(ranges[1]).toMatchObject({
      sprintNumber: "2026-2",
      startDate: date("2026-04-17"),
      endDate: date("2026-04-24"),
    });
  });

  it("preserves an unchanged pending cadence on ordinary saves and allows an explicit mode switch", async () => {
    const p = await project();
    const settings = { sprintStartDate: date("2026-04-16"), sprintDuration: 2 };
    await api.project.update({
      projectId: p.id,
      settings,
      applyTo: "next",
    });
    const unchanged = await api.project.update({
      projectId: p.id,
      settings: { ...settings, name: "Renamed" },
    });
    expect(unchanged.currentSprint?.endDate).toEqual(date("2026-04-30"));
    const switched = await api.project.update({
      projectId: p.id,
      settings,
      applyTo: "current",
    });
    expect(switched.currentSprint?.endDate).toEqual(date("2026-04-16"));
  });

  it("rejects current when the new cadence has no boundary left in it", async () => {
    const p = await project();
    await expect(setSprintStart(p.id, "2026-05-01")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await db.query.sprintScheduleChanges.findMany()).toHaveLength(1);
  });

  it("keeps completed/backlog/future stories unchanged while catching up several missed sprints", async () => {
    const p = await project();
    const overdue = await seedStory(p.id, "2026-1");
    const done = await seedStory(p.id, "2026-1", "done");
    const backlog = await seedStory(p.id, null);
    const future = await seedStory(p.id, "2026-10");
    vi.setSystemTime(date("2026-05-20"));
    const first = await api.story.list({ projectId: p.id });
    expect(first.find((s) => s.id === overdue.id)?.sprintNumber).toBe("2026-4");
    expect(first.find((s) => s.id === done.id)?.sprintNumber).toBe("2026-1");
    expect(first.find((s) => s.id === backlog.id)?.sprintNumber).toBeNull();
    expect(first.find((s) => s.id === future.id)?.sprintNumber).toBe("2026-10");
    expect(await api.story.list({ projectId: p.id })).toEqual(first);
  });

  const projectRequests: Record<
    string,
    (projectId: string, storyId: string) => Promise<unknown>
  > = {
    "story.update": (_projectId, id) =>
      api.story.update({ id, name: "Updated" }),
    "story.delete": (_projectId, id) => api.story.delete({ id }),
    "project.getById": (projectId) => api.project.getById({ projectId }),
    "project.list": () => api.project.list(),
    "project.update": (projectId) =>
      api.project.update({ projectId, settings: { name: "Updated" } }),
  };
  it.each(Object.entries(projectRequests))(
    "runs rollover before %s",
    async (_name, request) => {
      const p = await project();
      const overdue = await seedStory(p.id, "2026-1");
      const target = await seedStory(p.id, null);
      vi.setSystemTime(date("2026-04-20"));
      await request(p.id, target.id);
      expect(await readStory(overdue.id)).toMatchObject({
        sprintNumber: "2026-2",
      });
    },
  );

  it("clears all assignments on disable, retains schedule history, and supports re-enabling", async () => {
    const p = await project();
    await seedStory(p.id, "2026-1");
    await seedStory(p.id, "2026-1", "done");
    const other = await project();
    await seedStory(other.id, "2026-1");
    await setSprintStart(p.id, null);
    expect(
      (
        await db.query.stories.findMany({ where: eq(stories.projectId, p.id) })
      ).every((s) => s.sprintNumber === null),
    ).toBe(true);
    expect(
      (
        await db.query.stories.findFirst({
          where: eq(stories.projectId, other.id),
        })
      )?.sprintNumber,
    ).toBe("2026-1");
    expect(await api.sprint.getCurrentSprint({ projectId: p.id })).toBeNull();
    expect(
      await db.query.sprintScheduleChanges.findMany({
        where: eq(sprintScheduleChanges.projectId, p.id),
      }),
    ).toHaveLength(2);
    vi.setSystemTime(date("2026-04-12"));
    await setSprintStart(p.id, "2026-04-13");
    expect(await api.sprint.getCurrentSprint({ projectId: p.id })).toBeNull();
    vi.setSystemTime(date("2026-04-13"));
    expect(
      await api.sprint.getCurrentSprint({ projectId: p.id }),
    ).toMatchObject({ sprintNumber: "2026-2", startDate: date("2026-04-13") });
  });

  it("clears every assignment from the first missing sprint onward, even later valid years", async () => {
    vi.setSystemTime(date("2026-01-06"));
    const p = await project("2026-01-05", 1);
    const kept = await seedStory(p.id, "2026-2");
    const clash = await seedStory(p.id, "2026-3", "done");
    const later = await seedStory(p.id, "2027-1");
    await api.project.update({
      projectId: p.id,
      settings: { sprintStartDate: date("2026-01-12"), sprintDuration: 52 },
      applyTo: "next",
    });
    const result = await db.query.stories.findMany();
    expect(result.find((s) => s.id === kept.id)?.sprintNumber).toBe("2026-2");
    expect(result.find((s) => s.id === clash.id)).toMatchObject({
      sprintNumber: null,
      column: "done",
    });
    expect(result.find((s) => s.id === later.id)?.sprintNumber).toBeNull();
  });

  it("serializes simultaneous rollover requests and waits for a project lock before responding", async () => {
    const p = await project();
    const story = await seedStory(p.id, "2026-1");
    vi.setSystemTime(date("2026-04-20"));
    const release = await holdProject(p.id);
    let completed = false;
    const request = api.story.getById({ id: story.id }).then((result) => {
      completed = true;
      return result;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(completed).toBe(false);
      expect(await readStory(story.id)).toMatchObject({
        sprintNumber: "2026-1",
      });
    } finally {
      await release();
    }
    expect((await request).sprintNumber).toBe("2026-2");
    const simultaneous = await Promise.all(
      Array.from({ length: 5 }, () => api.story.getById({ id: story.id })),
    );
    expect(
      simultaneous.every((result) => result.sprintNumber === "2026-2"),
    ).toBe(true);
  });

  it("rolls back rollover when the handler fails and never lets unauthorized requests change data", async () => {
    const p = await project();
    await seedStory(p.id, "2026-1");
    vi.setSystemTime(date("2026-04-20"));
    const fail = () => {
      throw new TRPCError({ code: "BAD_REQUEST" });
    };
    const failing = createCallerFactory(
      createTRPCRouter({
        project: protectedProcedure
          .input(z.object({ projectId: z.string().uuid() }))
          .use(projectMiddleware)
          .mutation(fail),
        list: protectedProcedure.use(projectMiddleware).query(fail),
      }),
    )({ db, session: testSession, headers: new Headers() });
    for (const request of [
      () => failing.project({ projectId: p.id }),
      () => failing.list(),
    ]) {
      await expect(request()).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect((await db.query.stories.findFirst())?.sprintNumber).toBe("2026-1");
    }
    await expect(
      createTestCaller(null).sprint.getCurrentSprint({ projectId: p.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const [privateProject] = await db
      .insert(projects)
      .values({ name: "Private" })
      .returning();
    await expect(
      api.sprint.listSprints({ projectId: privateProject!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps no-op settings stable and edits a disabled duration without inventing history", async () => {
    const p = await project();
    await api.project.update({
      projectId: p.id,
      settings: { sprintStartDate: date("2026-04-06"), sprintDuration: 2 },
    });
    expect(await db.query.sprintScheduleChanges.findMany()).toHaveLength(1);
    await api.project.update({
      projectId: p.id,
      settings: { sprintDuration: 2 },
      applyTo: "next",
    });
    expect(await db.query.sprintScheduleChanges.findMany()).toHaveLength(1);
    const disabled = await api.project.create({ name: "Disabled" });
    await api.project.update({
      projectId: disabled.id,
      settings: { sprintDuration: 3 },
    });
    expect(
      await db.query.sprintScheduleChanges.findMany({
        where: eq(sprintScheduleChanges.projectId, disabled.id),
      }),
    ).toEqual([]);
    expect(await api.project.list()).toHaveLength(2);
  });

  it("re-enables from the next boundary of a past anchor without rewriting elapsed dates", async () => {
    const p = await project();
    await setSprintStart(p.id, null);
    vi.setSystemTime(date("2026-04-12"));
    await setSprintStart(p.id, "2026-04-06");
    const ranges = await api.sprint.listSprints({ projectId: p.id });
    expect(ranges[0]).toMatchObject({
      startDate: date("2026-04-06"),
      endDate: date("2026-04-10"),
    });
    expect(ranges[1]).toMatchObject({
      sprintNumber: "2026-2",
      startDate: date("2026-04-20"),
    });
    vi.setSystemTime(date("2026-04-20"));
    expect(
      (await api.sprint.listSprints({ projectId: p.id }))[1]?.sprintNumber,
    ).toBe("2026-2");
  });

  it.each([
    ["2026-04-12T00:00:00Z", "2026-04-12T12:00:00Z", "2026-04-26T00:00:00Z"],
    ["2026-04-12T22:00:00Z", "2026-04-13T12:00:00Z", "2026-04-26T22:00:00Z"],
  ])(
    "re-enables at %s without skipping the selected start",
    async (start, now, end) => {
      const p = await project();
      await setSprintStart(p.id, null);
      vi.setSystemTime(new Date(now));
      const updated = await api.project.update({
        projectId: p.id,
        settings: { sprintStartDate: new Date(start) },
      });
      expect(updated.currentSprint).toEqual({
        sprintNumber: "2026-2",
        startDate: new Date(start),
        endDate: new Date(end),
        daysRemaining: 14,
      });
      expect(
        (await api.sprint.listSprints({ projectId: p.id, year: 2026 }))[0],
      ).toMatchObject({
        startDate: date("2026-04-06"),
        endDate: date("2026-04-10"),
      });
    },
  );

  it("immediately catches up expired assignments and reopened completed issues", async () => {
    const p = await project();
    vi.setSystemTime(date("2026-04-20"));
    const created = await api.story.create({
      projectId: p.id,
      name: "Old assignment",
      sprintNumber: "2026-1",
    });
    expect(created.sprintNumber).toBe("2026-2");
    const completed = await api.story.create({
      projectId: p.id,
      name: "Historic done",
      column: "done",
      sprintNumber: "2026-1",
    });
    expect(completed.sprintNumber).toBe("2026-1");
    expect(
      (await api.story.update({ id: completed.id, column: "todo" }))
        .sprintNumber,
    ).toBe("2026-2");
    expect(
      (await api.story.update({ id: created.id, sprintNumber: "2026-1" }))
        .sprintNumber,
    ).toBe("2026-2");
  });

  it("blocks the handler if the rollover update fails", async () => {
    const p = await project();
    await seedStory(p.id, "2026-1");
    vi.setSystemTime(date("2026-04-20"));
    await db.execute(
      sql`CREATE FUNCTION issue9_fail_rollover() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Deliberate rollover failure'; END $$`,
    );
    await db.execute(
      sql`CREATE TRIGGER issue9_rollover_failure BEFORE UPDATE ON story FOR EACH ROW EXECUTE FUNCTION issue9_fail_rollover()`,
    );
    try {
      await expect(api.story.list({ projectId: p.id })).rejects.toThrow();
      expect((await db.query.stories.findFirst())?.sprintNumber).toBe("2026-1");
    } finally {
      await db.execute(sql`DROP TRIGGER issue9_rollover_failure ON story`);
      await db.execute(sql`DROP FUNCTION issue9_fail_rollover()`);
    }
  });

  it.each(["getById", "update", "delete"] as const)(
    "handles a concurrent deletion before story.%s acquires the lock",
    async (method) => {
      const p = await project();
      const story = await seedStory(p.id, null);
      const release = await holdProject(p.id, (tx) =>
        tx.delete(stories).where(eq(stories.id, story.id)),
      );
      const request =
        method === "update"
          ? api.story.update({ id: story.id, name: "Deleted" })
          : api.story[method]({ id: story.id });
      // The uncommitted deletion is still visible to the initial project lookup.
      const outcome = expect(request).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        await release();
      }
      await outcome;
    },
  );
});
