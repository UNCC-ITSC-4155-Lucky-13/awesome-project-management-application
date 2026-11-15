import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { projectMembers, stories, storyAssignees } from "@/server/db/schema";
import { type db as _db } from "@/server/db";

type DB = typeof _db;

const verifyProjectMembership = async (
  database: DB,
  projectId: string,
  userId: string,
): Promise<void> => {
  const member = await database.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    ),
  });
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this project",
    });
  }
};

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
    .mutation(async ({ ctx, input }) => {
      await verifyProjectMembership(
        ctx.db,
        input.projectId,
        ctx.session.user.id,
      );

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
            sprintNumber: input.sprintNumber,
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

        return newStory;
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, input.id),
        with: { assignees: true },
      });

      if (!story) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyProjectMembership(
        ctx.db,
        story.projectId,
        ctx.session.user.id,
      );

      return story;
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
      await verifyProjectMembership(
        ctx.db,
        story.projectId,
        ctx.session.user.id,
      );

      return await ctx.db.transaction(async (tx) => {
        const finalUpdate: Partial<typeof stories.$inferInsert> = {
          ...updateData,
        };

        if (updateData.column && updateData.column !== story.column) {
          finalUpdate.lastMovedAt = new Date();
        }

        let updatedStory = story;
        // Only run the update query if there are actual fields to set
        if (Object.keys(finalUpdate).length > 0) {
          const [result] = await tx
            .update(stories)
            .set(finalUpdate)
            .where(eq(stories.id, id))
            .returning();

          updatedStory = result!;
        }

        if (assigneeIds) {
          await tx.delete(storyAssignees).where(eq(storyAssignees.storyId, id));
          if (assigneeIds.length > 0) {
            await tx
              .insert(storyAssignees)
              .values(assigneeIds.map((userId) => ({ storyId: id, userId })));
          }
        }

        return updatedStory;
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, input.id),
      });

      if (!story) throw new TRPCError({ code: "NOT_FOUND" });

      await verifyProjectMembership(
        ctx.db,
        story.projectId,
        ctx.session.user.id,
      );

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
    .query(async ({ ctx, input }) => {
      await verifyProjectMembership(
        ctx.db,
        input.projectId,
        ctx.session.user.id,
      );

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

      return await ctx.db.query.stories.findMany({
        where: whereClause,
        with: { assignees: true },
        orderBy,
      });
    }),
});
