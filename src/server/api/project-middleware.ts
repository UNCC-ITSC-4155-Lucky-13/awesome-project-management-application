import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { projectMembers, stories } from "@/server/db/schema";
import { prepareProject } from "@/server/lib/project-sprints";
import { createTRPCMiddleware } from "./trpc";

/** Verifies project membership and completes sprint rollover before the handler. */
export const projectMiddleware = createTRPCMiddleware(
  async ({ ctx, input, next }) => {
    const ids = input as { projectId?: string; id?: string } | undefined;
    let projectIds: string[];
    if (ids?.id) {
      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, ids.id),
      });
      if (!story) throw new TRPCError({ code: "NOT_FOUND" });
      if (ids.projectId && ids.projectId !== story.projectId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      projectIds = [story.projectId];
    } else if (ids?.projectId) {
      projectIds = [ids.projectId];
    } else {
      const memberships = await ctx.db.query.projectMembers.findMany({
        where: eq(projectMembers.userId, ctx.session!.user.id),
      });
      // Stable lock order prevents simultaneous project-list requests from deadlocking.
      projectIds = memberships.map((membership) => membership.projectId).sort();
    }
    return ctx.db.transaction(async (transaction) => {
      const projectStates = [];
      for (const projectId of projectIds) {
        projectStates.push(
          await prepareProject(transaction, projectId, ctx.session!.user.id),
        );
      }
      // ID-based handlers receive one state; project listing uses the full array.
      const state = projectStates[0]!;
      const result = await next({
        ctx: { db: transaction, ...state, projectStates },
      });
      // tRPC returns handler errors as results. Throw so PostgreSQL rolls back too.
      if (!result.ok) throw result.error;
      return result;
    });
  },
);
