import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { projectMembers, stories, storyAssignees } from "@/server/db/schema";

// Helper to verify the user is a member of the project
const verifyProjectMembership = async (
  db: any,
  projectId: string,
  userId: string,
) => {
  const member = await db.query.projectMembers.findFirst({
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

      return await ctx.db.transaction(async (tx: any) => {
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

        if (!newStory) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        if (input.assigneeIds && input.assigneeIds.length > 0) {
          await tx.insert(storyAssignees).values(
            input.assigneeIds.map((userId: string) => ({
              storyId: newStory.id,
              userId,
            })),
          );
        }

        return newStory;
      });
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
      const story = await ctx.db.query.stories.findFirst({
        where: eq(stories.id, input.id),
      });

      if (!story) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyProjectMembership(
        ctx.db,
        story.projectId,
        ctx.session.user.id,
      );

      const { id, assigneeIds, ...updateData } = input;

      return await ctx.db.transaction(async (tx: any) => {
        // If the column changed, update lastMovedAt automatically
        if (updateData.column && updateData.column !== story.column) {
          Object.assign(updateData, { lastMovedAt: new Date() });
        }

        // Update the story fields
        const [updatedStory] = await tx
          .update(stories)
          .set(updateData)
          .where(eq(stories.id, id))
          .returning();

        // Sync assignees if provided
        if (assigneeIds) {
          await tx.delete(storyAssignees).where(eq(storyAssignees.storyId, id));
          if (assigneeIds.length > 0) {
            await tx
              .insert(storyAssignees)
              .values(
                assigneeIds.map((userId: string) => ({ storyId: id, userId })),
              );
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

      return await ctx.db.query.stories.findMany({
        where: whereClause,
        with: {
          assignees: true,
        },
      });
    }),
});
