import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db } from "@/server/db";
import { comments, projectMembers, stories, user } from "@/server/db/schema";

type Database = typeof db;

const commentContent = z.string().trim().min(1);

// A comment plus the public fields of its author. Never select the whole
// user row, which includes the email address.
const commentWithAuthor = {
  id: comments.id,
  storyId: comments.storyId,
  content: comments.content,
  createdAt: comments.createdAt,
  editedAt: comments.editedAt,
  author: { id: user.id, name: user.name, image: user.image },
};

function selectCommentsWithAuthor(database: Database) {
  return database
    .select(commentWithAuthor)
    .from(comments)
    .innerJoin(user, eq(comments.createdBy, user.id));
}

async function findMembership(
  database: Database,
  projectId: string,
  userId: string,
) {
  return database.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    ),
  });
}

// The caller must belong to the project.
async function requireMember(
  database: Database,
  projectId: string,
  userId: string,
) {
  const membership = await findMembership(database, projectId, userId);

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return membership;
}

// Comments don't store a project, so we go story -> project to find out
// whether the caller belongs to the project that owns the story.
async function requireStoryMember(
  database: Database,
  storyId: string,
  userId: string,
) {
  const story = await database.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  await requireMember(database, story.projectId, userId);
}

// One query gives us both a comment's author and the project its story
// belongs to.
async function findCommentTarget(database: Database, commentId: string) {
  const [target] = await database
    .select({
      createdBy: comments.createdBy,
      projectId: stories.projectId,
    })
    .from(comments)
    .innerJoin(stories, eq(comments.storyId, stories.id))
    .where(eq(comments.id, commentId));

  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return target;
}

export const commentRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ storyId: z.string().uuid(), content: commentContent }))
    .mutation(async ({ ctx, input }) => {
      await requireStoryMember(ctx.db, input.storyId, ctx.session.user.id);

      const [created] = await ctx.db
        .insert(comments)
        .values({
          storyId: input.storyId,
          createdBy: ctx.session.user.id,
          content: input.content,
        })
        .returning({ id: comments.id });

      const [result] = await selectCommentsWithAuthor(ctx.db).where(
        eq(comments.id, created!.id),
      );

      return result!;
    }),

  edit: protectedProcedure
    .input(z.object({ id: z.string().uuid(), content: commentContent }))
    .mutation(async ({ ctx, input }) => {
      const target = await findCommentTarget(ctx.db, input.id);

      // Only the author may edit, even project admins and owners.
      if (target.createdBy !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // The author must also still belong to the project.
      await requireMember(ctx.db, target.projectId, ctx.session.user.id);

      const [updated] = await ctx.db
        .update(comments)
        .set({ content: input.content, editedAt: new Date() })
        .where(eq(comments.id, input.id))
        .returning();

      return updated!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const target = await findCommentTarget(ctx.db, input.id);

      // The author may always delete their own comment. Anyone else must be
      // an admin or owner of the project.
      if (target.createdBy !== ctx.session.user.id) {
        const membership = await requireMember(
          ctx.db,
          target.projectId,
          ctx.session.user.id,
        );

        if (membership.role === "member") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      await ctx.db.delete(comments).where(eq(comments.id, input.id));

      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ storyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireStoryMember(ctx.db, input.storyId, ctx.session.user.id);

      return selectCommentsWithAuthor(ctx.db)
        .where(eq(comments.storyId, input.storyId))
        .orderBy(asc(comments.createdAt));
    }),
});
