import { z } from "zod";

import { millisecondsInWeek } from "date-fns/constants";
import { sprintMiddleware } from "@/server/api/sprint-middleware";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { calculateSprints, scheduleHorizon } from "@/server/lib/sprints";

export const sprintRouter = createTRPCRouter({
  getCurrentSprint: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(sprintMiddleware)
    .query(({ ctx }) => ctx.currentSprint),
  listSprints: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        pastCount: z.number().int().min(0).max(100).default(3),
        futureCount: z.number().int().min(0).max(100).default(6),
        year: z.number().int().min(1000).max(9998).optional(),
      }),
    )
    .use(sprintMiddleware)
    .query(({ ctx, input }) => {
      if (!ctx.project.sprintStartDate) return [];
      if (input.year !== undefined) {
        return calculateSprints(
          ctx.changes,
          scheduleHorizon(ctx.changes, ctx.now, input.year),
          ctx.now,
        ).filter((sprint) => sprint.startDate.getUTCFullYear() === input.year);
      }
      const reference = Math.max(
        ctx.now.getTime(),
        ...ctx.changes.map((change) => change.startDate.getTime()),
      );
      const until = new Date(
        reference +
          (input.futureCount + 2) *
            Math.max(
              1,
              ...ctx.changes.map((change) => change.durationWeeks ?? 0),
            ) *
            millisecondsInWeek,
      );
      const sprints = calculateSprints(ctx.changes, until, ctx.now);
      const index = Math.max(
        0,
        sprints.findIndex((sprint) => sprint.endDate > ctx.now),
      );
      return sprints.slice(
        Math.max(0, index - input.pastCount),
        index + input.futureCount + (ctx.currentSprint ? 1 : 0),
      );
    }),
});
