import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db } from "@/server/db";
import { projectMembers, user } from "@/server/db/schema";

type Database = typeof db;

const memberInput = z.object({
  projectId: z.string().uuid(),
  userId: z.string(),
});

const membershipWhere = (projectId: string, userId: string) =>
  and(
    eq(projectMembers.projectId, projectId),
    eq(projectMembers.userId, userId),
  );

async function findMembership(
  database: Database,
  projectId: string,
  userId: string,
) {
  return database.query.projectMembers.findFirst({
    where: membershipWhere(projectId, userId),
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

// The caller must belong to the project as an admin or owner.
async function requireManager(
  database: Database,
  projectId: string,
  userId: string,
) {
  const membership = await requireMember(database, projectId, userId);

  if (membership.role === "member") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

// The user being changed must belong to the same project as the request.
async function requireTarget(
  database: Database,
  projectId: string,
  userId: string,
) {
  const membership = await findMembership(database, projectId, userId);

  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
}

export const memberRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireMember(ctx.db, input.projectId, ctx.session.user.id);

      // Select only the public fields the UI needs, never the whole user row
      // (which includes the email address).
      return ctx.db
        .select({
          userId: user.id,
          name: user.name,
          image: user.image,
          role: projectMembers.role,
        })
        .from(projectMembers)
        .innerJoin(user, eq(projectMembers.userId, user.id))
        .where(eq(projectMembers.projectId, input.projectId));
    }),

  updateRole: protectedProcedure
    .input(memberInput.extend({ role: z.enum(["owner", "admin", "member"]) }))
    .mutation(async ({ ctx, input }) => {
      await requireManager(ctx.db, input.projectId, ctx.session.user.id);
      await requireTarget(ctx.db, input.projectId, input.userId);

      const [updated] = await ctx.db
        .update(projectMembers)
        .set({ role: input.role })
        .where(membershipWhere(input.projectId, input.userId))
        .returning();

      return updated!;
    }),

  remove: protectedProcedure
    .input(memberInput)
    .mutation(async ({ ctx, input }) => {
      await requireManager(ctx.db, input.projectId, ctx.session.user.id);
      await requireTarget(ctx.db, input.projectId, input.userId);

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(projectMembers)
          .where(membershipWhere(input.projectId, input.userId));
      });

      return { success: true };
    }),
});