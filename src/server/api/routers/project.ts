import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  projectListProcedure,
  projectProcedure,
} from "@/server/api/project-procedure";
import { projectName } from "@/lib/project-schemas";
import { DEFAULT_PROJECT_SETTINGS } from "@/server/constants/projects";
import {
  projectMembers,
  projects,
  sprintScheduleChanges,
} from "@/server/db/schema";
import { changeSchedule, prepareProject } from "@/server/lib/project-sprints";
import {
  calculateSprints,
  getCurrentSprint,
  scheduleHorizon,
} from "@/server/lib/sprints";

const sprintSettings = z.object({
  sprintDuration: z.number().int().positive().optional(),
  sprintStartDate: z
    .date()
    .refine(
      (date) =>
        date.getUTCFullYear() >= 1000 &&
        date.getUTCFullYear() <= 9998 &&
        date.getTime() % 86_400_000 === 0,
      "Use a UTC calendar date between years 1000 and 9998",
    )
    .nullable()
    .optional(),
});

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
      return ctx.db.transaction(async (tx) => {
        const [project] = await tx
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
        await tx.insert(projectMembers).values({
          projectId: project!.id,
          userId: ctx.session.user.id,
          role: "owner",
        });
        const changes = project!.sprintStartDate
          ? [
              {
                projectId: project!.id,
                startDate: project!.sprintStartDate,
                durationWeeks: project!.sprintDuration,
                previousSprintStartDate: null,
              },
            ]
          : [];
        if (changes.length)
          await tx.insert(sprintScheduleChanges).values(changes);
        const now = new Date();
        return {
          ...project!,
          currentSprint: getCurrentSprint(
            calculateSprints(changes, scheduleHorizon(changes, now), now),
            now,
          ),
        };
      });
    }),

  list: projectListProcedure.query(({ ctx }) =>
    ctx.projectStates.map(({ project, currentSprint }) => ({
      ...project,
      currentSprint,
    })),
  ),

  getById: projectProcedure.query(({ ctx }) => ({
    ...ctx.project,
    role: ctx.membership.role,
    currentSprint: ctx.currentSprint,
  })),

  update: projectProcedure
    .input(
      z.object({
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
        applyTo: z.enum(["current", "next"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      await changeSchedule(
        ctx.db,
        ctx.project,
        ctx.changes,
        input.settings,
        input.applyTo,
        ctx.now,
      );
      await ctx.db
        .update(projects)
        .set(input.settings)
        .where(eq(projects.id, input.projectId));
      const state = await prepareProject(
        ctx.db,
        input.projectId,
        ctx.session.user.id,
      );
      return { ...state.project, currentSprint: state.currentSprint };
    }),

  delete: projectProcedure.mutation(async ({ ctx, input }) => {
    if (ctx.membership.role !== "owner")
      throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db.delete(projects).where(eq(projects.id, input.projectId));
    return { success: true };
  }),
});
