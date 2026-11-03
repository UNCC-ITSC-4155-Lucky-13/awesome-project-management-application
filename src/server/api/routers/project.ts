import { TRPCError } from "@trpc/server";
import { and, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { DEFAULT_PROJECT_SETTINGS } from "@/server/constants/projects";
import type { db } from "@/server/db";
import { projectMembers, projects } from "@/server/db/schema";

const projectInput = z.object({ projectId: z.string().uuid() });
const projectName = z.string().trim().min(1).max(255);
const sprintSettings = z.object({
  sprintDuration: z.number().int().positive().optional(),
  sprintStartDate: z.date().nullable().optional(),
});

async function requireProjectMembership(
  database: typeof db,
  projectId: string,
  userId: string,
) {
  const membership = await database.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    ),
  });

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return membership;
}

export const projectRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: projectName,
        description: z.string().optional(),
        settings: sprintSettings.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (transaction) => {
        const [project] = await transaction
          .insert(projects)
          .values({
            name: input.name,
            description: input.description,
            sprintDuration:
              input.settings?.sprintDuration ??
              DEFAULT_PROJECT_SETTINGS.sprintDuration,
            sprintStartDate:
              input.settings?.sprintStartDate ??
              DEFAULT_PROJECT_SETTINGS.sprintStartDate,
          })
          .returning();

        await transaction.insert(projectMembers).values({
          projectId: project!.id,
          userId: ctx.session.user.id,
          role: "owner",
        });

        return project!;
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select(getTableColumns(projects))
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, ctx.session.user.id));
  }),

  getById: protectedProcedure
    .input(projectInput)
    .query(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({ ...getTableColumns(projects), role: projectMembers.role })
        .from(projects)
        .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projectMembers.userId, ctx.session.user.id),
          ),
        );

      if (!project) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return project;
    }),

  update: protectedProcedure
    .input(
      projectInput.extend({
        settings: sprintSettings
          .extend({
            name: projectName.optional(),
            description: z.string().nullable().optional(),
          })
          .refine(
            (settings) =>
              Object.values(settings).some((value) => value !== undefined),
            { message: "At least one setting must be supplied" },
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.session.user.id,
      );

      if (membership.role !== "owner" && membership.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [project] = await ctx.db
        .update(projects)
        .set(input.settings)
        .where(eq(projects.id, input.projectId))
        .returning();

      return project!;
    }),

  delete: protectedProcedure
    .input(projectInput)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.session.user.id,
      );

      if (membership.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.delete(projects).where(eq(projects.id, input.projectId));

      return { success: true };
    }),
});
