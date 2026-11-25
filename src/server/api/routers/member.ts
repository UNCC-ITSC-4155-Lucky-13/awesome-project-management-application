import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db } from "@/server/db";
import { projectMembers, user, views } from "@/server/db/schema";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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

// Locks the project's owner and admin rows until the transaction ends, so
// concurrent removals and demotions run one at a time, then rejects the change
// if it would leave the project without anyone able to manage it.
async function requireAnotherManager(
  tx: Transaction,
  projectId: string,
  userId: string,
) {
  const managers = await tx
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        inArray(projectMembers.role, ["owner", "admin"]),
      ),
    )
    // A consistent order keeps concurrent requests from deadlocking.
    .orderBy(projectMembers.userId)
    .for("update");

  const isManager = managers.some((manager) => manager.userId === userId);
  const hasAnotherManager = managers.some(
    (manager) => manager.userId !== userId,
  );

  if (isManager && !hasAnotherManager) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "A project needs at least one owner or admin. Appoint another owner or admin first.",
    });
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

      return ctx.db.transaction(async (tx) => {
        // Only a demotion can leave the project without an owner or admin.
        if (input.role === "member") {
          await requireAnotherManager(tx, input.projectId, input.userId);
        }

        const [updated] = await tx
          .update(projectMembers)
          .set({ role: input.role })
          .where(membershipWhere(input.projectId, input.userId))
          .returning();

        return updated!;
      });
    }),

  remove: protectedProcedure
    .input(memberInput)
    .mutation(async ({ ctx, input }) => {
      await requireManager(ctx.db, input.projectId, ctx.session.user.id);
      await requireTarget(ctx.db, input.projectId, input.userId);

      await ctx.db.transaction(async (tx) => {
        await requireAnotherManager(tx, input.projectId, input.userId);
        await tx
          .delete(views)
          .where(
            and(
              eq(views.projectId, input.projectId),
              eq(views.ownerUserId, input.userId),
            ),
          );

        await tx
          .delete(projectMembers)
          .where(membershipWhere(input.projectId, input.userId));
      });

      return { success: true };
    }),
});
