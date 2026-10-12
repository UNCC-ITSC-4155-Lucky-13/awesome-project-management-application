import { and, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db } from "@/server/db";
import type { Session } from "@/server/better-auth/config";
import {
  account,
  projectInvites,
  projectMembers,
  projects,
  user,
} from "@/server/db/schema";

const INVITE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
type Database = typeof db;

const requireProjectMember = async (
  db: Database,
  projectId: string,
  userId: string,
) => {
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    ),
  });

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
};

const getGithubUsername = async (
  db: Database,
  sessionUser: Session["user"],
) => {
  const userWithGithubUsername = sessionUser as typeof sessionUser & {
    githubUsername?: string;
    username?: string;
  };
  if (userWithGithubUsername.githubUsername) {
    return userWithGithubUsername.githubUsername;
  }
  if (userWithGithubUsername.username) {
    return userWithGithubUsername.username;
  }

  const githubAccount = await db.query.account.findFirst({
    where: and(
      eq(account.userId, sessionUser.id),
      eq(account.providerId, "github"),
    ),
  });

  return githubAccount?.accountId ?? sessionUser.name;
};

export const inviteRouter = createTRPCRouter({
  send: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        githubUsername: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.session.user.id);

      const expiresAt = new Date(Date.now() + INVITE_DURATION_MS);
      const [invite] = await ctx.db
        .insert(projectInvites)
        .values({
          githubUsername: input.githubUsername,
          projectId: input.projectId,
          createdBy: ctx.session.user.id,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [projectInvites.githubUsername, projectInvites.projectId],
          set: {
            createdBy: ctx.session.user.id,
            createdAt: new Date(),
            expiresAt,
          },
        })
        .returning();

      return invite!;
    }),

  listSelf: protectedProcedure.query(async ({ ctx }) => {
    const githubUsername = await getGithubUsername(ctx.db, ctx.session.user);
    const now = new Date();

    return ctx.db
      .select({
        projectId: projectInvites.projectId,
        projectName: projects.name,
        expiresAt: projectInvites.expiresAt,
        createdAt: projectInvites.createdAt,
        createdBy: projectInvites.createdBy,
      })
      .from(projectInvites)
      .innerJoin(projects, eq(projectInvites.projectId, projects.id))
      .innerJoin(user, eq(projectInvites.createdBy, user.id))
      .where(
        and(
          eq(projectInvites.githubUsername, githubUsername),
          gt(projectInvites.expiresAt, now),
        ),
      );
  }),

  listProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.session.user.id);

      return ctx.db
        .select({
          githubUsername: projectInvites.githubUsername,
          projectId: projectInvites.projectId,
          expiresAt: projectInvites.expiresAt,
          createdAt: projectInvites.createdAt,
          createdBy: projectInvites.createdBy,
        })
        .from(projectInvites)
        .where(
          and(
            eq(projectInvites.projectId, input.projectId),
            gt(projectInvites.expiresAt, new Date()),
          ),
        );
    }),

  respond: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        action: z.enum(["accept", "deny"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const githubUsername = await getGithubUsername(ctx.db, ctx.session.user);
      const [invite] = await ctx.db
        .select()
        .from(projectInvites)
        .where(
          and(
            eq(projectInvites.projectId, input.projectId),
            eq(projectInvites.githubUsername, githubUsername),
            gt(projectInvites.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.transaction(async (tx) => {
        if (input.action === "accept") {
          await tx
            .insert(projectMembers)
            .values({
              projectId: input.projectId,
              userId: ctx.session.user.id,
              role: "member",
            })
            .onConflictDoNothing();
        }
        await tx.delete(projectInvites).where(eq(projectInvites.id, invite.id));
      });

      return { success: true };
    }),
});
