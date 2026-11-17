import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { projectMembers, stories } from "@/server/db/schema";
import { prepareProject } from "@/server/lib/project-sprints";
import { createTRPCMiddleware, protectedProcedure } from "./trpc";

function projectMiddleware(target: "project" | "story") {
  return createTRPCMiddleware(async ({ ctx, input, next }) => {
    const ids = input as { projectId: string; id: string };
    let projectId = ids.projectId;
    if (target === "story") {
      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, ids.id),
      });
      if (!story) throw new TRPCError({ code: "NOT_FOUND" });
      projectId = story.projectId;
    }
    return ctx.db.transaction(async (tx) => {
      const state = await prepareProject(tx, projectId, ctx.session!.user.id);
      const result = await next({ ctx: { db: tx, ...state } });
      // tRPC returns handler errors as results. Throw so PostgreSQL rolls back too.
      if (!result.ok) throw result.error;
      return result;
    });
  });
}

export const projectProcedure = protectedProcedure
  .input(z.object({ projectId: z.string().uuid() }))
  .use(projectMiddleware("project"));

export const storyProcedure = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .use(projectMiddleware("story"));

export const projectListProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const memberships = await ctx.db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, ctx.session.user.id),
    });
    return ctx.db.transaction(async (tx) => {
      const projectStates = [];
      // Stable lock order prevents two project-list requests from deadlocking.
      for (const membership of memberships.sort((a, b) =>
        a.projectId.localeCompare(b.projectId),
      )) {
        projectStates.push(
          await prepareProject(tx, membership.projectId, ctx.session.user.id),
        );
      }
      const result = await next({ ctx: { db: tx, projectStates } });
      if (!result.ok) throw result.error;
      return result;
    });
  },
);
