import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { projectMiddleware } from "@/server/api/project-middleware";
import {
  rolloverAssignment,
  validateSprint,
} from "@/server/lib/project-sprints";
import {
  calculateSprints,
  scheduleHorizon,
  withSprint,
} from "@/server/lib/sprints";
import { comments, stories, storyAssignees } from "@/server/db/schema";
export const storyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        storyPoints: z.number().int().optional(),
        column: z.string().optional().default("backlog"),
        sprintNumber: z
          .string()
          .regex(/^\d{4}-\d+$/, "Sprint must be format YYYY-N")
          .optional()
          .nullable(),
        assigneeIds: z.array(z.string()).optional(),
      }),
    )
    .use(projectMiddleware)
    .mutation(async ({ ctx, input }) => {
      const assignmentSprints = input.sprintNumber
        ? calculateSprints(
            ctx.changes,
            scheduleHorizon(
              ctx.changes,
              ctx.now,
              Number(input.sprintNumber.slice(0, 4)),
            ),
            ctx.now,
          )
        : ctx.sprints;
      validateSprint(input.sprintNumber, ctx.project, assignmentSprints);
      return await ctx.db.transaction(async (tx) => {
        const [newStory] = await tx
          .insert(stories)
          .values({
            projectId: input.projectId,
            creatorId: ctx.session.user.id,
            name: input.name,
            description: input.description,
            storyPoints: input.storyPoints,
            column: input.column,
            sprintNumber: rolloverAssignment(
              input.sprintNumber,
              input.column,
              assignmentSprints,
              ctx.currentSprint,
              ctx.now,
            ),
            lastMovedAt: new Date(),
          })
          .returning();

        if (input.assigneeIds && input.assigneeIds.length > 0) {
          await tx.insert(storyAssignees).values(
            input.assigneeIds.map((userId) => ({
              storyId: newStory!.id,
              userId,
            })),
          );
        }

        return withSprint(newStory!, assignmentSprints);
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(projectMiddleware)
    .query(async ({ ctx, input }) => {
      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, input.id),
        with: { assignees: true },
      });

      if (!story) throw new TRPCError({ code: "NOT_FOUND" });

      const sprints = story.sprintNumber
        ? calculateSprints(
            ctx.changes,
            scheduleHorizon(
              ctx.changes,
              ctx.now,
              Number(story.sprintNumber.slice(0, 4)),
            ),
            ctx.now,
          )
        : ctx.sprints;
      return withSprint(story, sprints);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        column: z.string().optional(),
        sprintNumber: z
          .string()
          .regex(/^\d{4}-\d+$/, "Sprint must be format YYYY-N")
          .optional()
          .nullable(),
        storyPoints: z.number().int().optional().nullable(),
        assigneeIds: z.array(z.string()).optional(),
      }),
    )
    .use(projectMiddleware)
    .mutation(async ({ ctx, input }) => {
      const { id, assigneeIds, ...updateData } = input;

      if (Object.keys(updateData).length === 0) {
        if (!assigneeIds) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one field must be provided to update",
          });
        }
      }

      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, id),
      });

      if (!story) throw new TRPCError({ code: "NOT_FOUND" });

      const sprintNumber =
        input.sprintNumber === undefined
          ? story.sprintNumber
          : input.sprintNumber;
      const assignmentSprints = sprintNumber
        ? calculateSprints(
            ctx.changes,
            scheduleHorizon(
              ctx.changes,
              ctx.now,
              Number(sprintNumber.slice(0, 4)),
            ),
            ctx.now,
          )
        : ctx.sprints;
      validateSprint(input.sprintNumber, ctx.project, assignmentSprints);
      return await ctx.db.transaction(async (tx) => {
        const finalUpdate: Partial<typeof stories.$inferInsert> = {
          ...updateData,
          sprintNumber: rolloverAssignment(
            sprintNumber,
            input.column ?? story.column,
            assignmentSprints,
            ctx.currentSprint,
            ctx.now,
          ),
        };

        if (updateData.column && updateData.column !== story.column) {
          finalUpdate.lastMovedAt = new Date();
        }

        const [updatedStory] = await tx
          .update(stories)
          .set(finalUpdate)
          .where(eq(stories.id, id))
          .returning();

        if (assigneeIds) {
          await tx.delete(storyAssignees).where(eq(storyAssignees.storyId, id));
          if (assigneeIds.length > 0) {
            await tx
              .insert(storyAssignees)
              .values(assigneeIds.map((userId) => ({ storyId: id, userId })));
          }
        }

        return withSprint(updatedStory!, assignmentSprints);
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(projectMiddleware)
    .mutation(async ({ ctx, input }) => {
      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, input.id),
      });

      if (!story) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.delete(stories).where(eq(stories.id, input.id));

      return { success: true };
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        sprintNumber: z.string().optional(),
        assigneeId: z.string().optional(),
        column: z.string().optional(),
        sort: z.enum(["createdAt", "lastMovedAt", "storyPoints"]).optional(),
      }),
    )
    .use(projectMiddleware)
    .query(async ({ ctx, input }) => {
      let whereClause = eq(stories.projectId, input.projectId);

      if (input.sprintNumber) {
        whereClause = and(
          whereClause,
          eq(stories.sprintNumber, input.sprintNumber),
        )!;
      }
      if (input.column) {
        whereClause = and(whereClause, eq(stories.column, input.column))!;
      }

      // Add assignee filter using a subquery
      if (input.assigneeId) {
        const assignedStoryIds = ctx.db
          .select({ id: storyAssignees.storyId })
          .from(storyAssignees)
          .where(eq(storyAssignees.userId, input.assigneeId));

        whereClause = and(whereClause, inArray(stories.id, assignedStoryIds))!;
      }

      // Determine sorting
      let orderBy;
      if (input.sort === "lastMovedAt") orderBy = desc(stories.lastMovedAt);
      else if (input.sort === "storyPoints")
        orderBy = desc(stories.storyPoints);
      else orderBy = desc(stories.createdAt); // default

      const result = await ctx.db.query.stories.findMany({
        where: whereClause,
        // Include assignee display data and comment counts so list views
        // render cards in one query.
        with: {
          assignees: {
            with: { user: { columns: { id: true, name: true, image: true } } },
          },
        },
        extras: {
          // Relational queries rewrite every column in extras to the story
          // table's alias and skip mapWith, so name the comment column
          // explicitly and cast the bigint count in SQL.
          commentCount: sql<number>`(
            select count(*)::int from ${comments}
            where ${comments}.${sql.identifier(comments.storyId.name)} = ${stories.id}
          )`.as("comment_count"),
        },
        orderBy,
      });
      const year = Math.max(
        ctx.now.getUTCFullYear(),
        ...result.map((story) => Number(story.sprintNumber?.slice(0, 4) ?? 0)),
      );
      const sprints = calculateSprints(
        ctx.changes,
        scheduleHorizon(ctx.changes, ctx.now, year),
        ctx.now,
      );
      return result.map((story) => withSprint(story, sprints));
    }),
});
