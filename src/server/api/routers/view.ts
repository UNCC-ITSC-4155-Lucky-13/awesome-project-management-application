import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db } from "@/server/db";
import {
  projectMembers,
  views,
  type ViewConfiguration,
} from "@/server/db/schema";

type Database = typeof db;

export const SUPPORTED_VIEW_ICONS = [
  "layout-dashboard",
  "board",
  "users",
  "user",
  "person",
  "calendar",
  "calendar-days",
  "bar-chart",
  "bar-chart-3",
  "table",
  "list",
  "kanban",
  "columns",
  "grid",
  "check-square",
  "clock",
  "tag",
  "bookmark",
  "settings",
  "folder",
  // PascalCase variants for icon components
  "LayoutDashboard",
  "LayoutDashboardIcon",
  "Users",
  "UsersIcon",
  "CalendarDays",
  "CalendarDaysIcon",
  "BarChart3",
  "BarChart3Icon",
] as const;

export const viewIconSchema = z.enum(SUPPORTED_VIEW_ICONS);
export type ViewIcon = z.infer<typeof viewIconSchema>;

export const viewIssueFieldSchema = z.enum(["status", "assignee", "sprint"]);
export type ViewIssueField = z.infer<typeof viewIssueFieldSchema>;

export const viewSortFieldSchema = z.enum([
  "createdAt",
  "lastMovedAt",
  "storyPoints",
]);
export type ViewSortField = z.infer<typeof viewSortFieldSchema>;

export const viewSortSchema = z.union([
  viewSortFieldSchema,
  z.object({
    field: viewSortFieldSchema,
    direction: z.enum(["asc", "desc"]).optional(),
  }),
]);
export type ViewSort = z.infer<typeof viewSortSchema>;

export const viewFiltersSchema = z.object({
  sprintNumber: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  column: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});
export type ViewFilters = z.infer<typeof viewFiltersSchema>;

export const viewConfigurationSchema = z.object({
  columns: z.array(z.string()).optional(),
  groupBy: viewIssueFieldSchema.optional(),
  rowGroup: viewIssueFieldSchema.nullable().optional(),
  rowSplit: viewIssueFieldSchema.nullable().optional(),
  grouping: z
    .object({
      column: viewIssueFieldSchema.optional(),
      row: viewIssueFieldSchema.nullable().optional(),
    })
    .optional(),
  filters: viewFiltersSchema.optional(),
  sort: viewSortSchema.nullable().optional(),
});

export const DEFAULT_BOARD_VIEW: {
  name: string;
  icon: ViewIcon;
  configuration: ViewConfiguration;
} = {
  name: "Board",
  icon: "layout-dashboard",
  configuration: {
    columns: ["backlog", "todo", "in_progress", "done"],
    groupBy: "status",
    rowGroup: null,
    filters: {},
    sort: null,
  },
};

export const DEFAULT_PERSON_VIEW: {
  name: string;
  icon: ViewIcon;
  configuration: ViewConfiguration;
} = {
  name: "By person",
  icon: "users",
  configuration: {
    columns: ["backlog", "todo", "in_progress", "done"],
    groupBy: "status",
    rowGroup: "assignee",
    filters: {},
    sort: null,
  },
};

/**
 * Ensures default workspace views (Board and By person) exist for a project.
 */
export async function ensureDefaultViews(
  database: Database,
  projectId: string,
): Promise<void> {
  const existingViews = await database.query.views.findMany({
    where: and(eq(views.projectId, projectId), isNull(views.ownerUserId)),
  });

  const hasBoard = existingViews.some(
    (v) => v.name === DEFAULT_BOARD_VIEW.name,
  );
  const hasPerson = existingViews.some(
    (v) => v.name === DEFAULT_PERSON_VIEW.name,
  );

  const toInsert: (typeof views.$inferInsert)[] = [];

  if (!hasBoard) {
    toInsert.push({
      projectId,
      ownerUserId: null,
      name: DEFAULT_BOARD_VIEW.name,
      icon: DEFAULT_BOARD_VIEW.icon,
      configuration: DEFAULT_BOARD_VIEW.configuration,
    });
  }

  if (!hasPerson) {
    toInsert.push({
      projectId,
      ownerUserId: null,
      name: DEFAULT_PERSON_VIEW.name,
      icon: DEFAULT_PERSON_VIEW.icon,
      configuration: DEFAULT_PERSON_VIEW.configuration,
    });
  }

  if (toInsert.length > 0) {
    await database.insert(views).values(toInsert);
  }
}

async function requireMembership(
  database: Database,
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
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this project",
    });
  }

  return membership;
}

export const viewRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.db, input.projectId, ctx.session.user.id);

      await ensureDefaultViews(ctx.db, input.projectId);

      return ctx.db.query.views.findMany({
        where: and(
          eq(views.projectId, input.projectId),
          or(
            isNull(views.ownerUserId),
            eq(views.ownerUserId, ctx.session.user.id),
          ),
        ),
        orderBy: [asc(views.createdAt)],
      });
    }),

  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const view = await ctx.db.query.views.findFirst({
        where: eq(views.id, input.id),
      });

      if (!view) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (input.projectId && input.projectId !== view.projectId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check caller's membership in view's project
      const membership = await ctx.db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, view.projectId),
          eq(projectMembers.userId, ctx.session.user.id),
        ),
      });

      // Avoid leaking view existence across projects
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Avoid leaking another user's private view
      if (
        view.ownerUserId !== null &&
        view.ownerUserId !== ctx.session.user.id
      ) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return view;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().trim().min(1, "Name cannot be empty").max(255),
        icon: viewIconSchema,
        configuration: viewConfigurationSchema,
        ownerUserId: z.string().nullable().optional(),
        scope: z.enum(["workspace", "personal"]).optional(),
        isWorkspaceView: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await requireMembership(
        ctx.db,
        input.projectId,
        ctx.session.user.id,
      );

      // Determine requested scope:
      // ownerUserId === null means Workspace View; a user ID means that user's My View.
      const wantsWorkspace =
        input.scope === "workspace" ||
        input.isWorkspaceView === true ||
        input.ownerUserId === null;

      let targetOwnerUserId: string | null = null;

      if (wantsWorkspace) {
        if (membership.role === "member") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Only project admins and owners can create Workspace Views",
          });
        }
        targetOwnerUserId = null;
      } else {
        // Personal view
        if (input.ownerUserId && input.ownerUserId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot create personal views for other users",
          });
        }
        targetOwnerUserId = ctx.session.user.id;
      }

      const [newView] = await ctx.db
        .insert(views)
        .values({
          projectId: input.projectId,
          ownerUserId: targetOwnerUserId,
          name: input.name,
          icon: input.icon,
          configuration: input.configuration,
        })
        .returning();

      return newView!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(255).optional(),
        icon: viewIconSchema.optional(),
        configuration: viewConfigurationSchema.optional(),
        ownerUserId: z.string().nullable().optional(),
        scope: z.enum(["workspace", "personal"]).optional(),
        isWorkspaceView: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        id,
        projectId,
        name,
        icon,
        configuration,
        ownerUserId,
        scope,
        isWorkspaceView,
      } = input;

      const hasUpdate =
        name !== undefined ||
        icon !== undefined ||
        configuration !== undefined ||
        ownerUserId !== undefined ||
        scope !== undefined ||
        isWorkspaceView !== undefined;

      if (!hasUpdate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one field must be provided to update",
        });
      }

      const view = await ctx.db.query.views.findFirst({
        where: eq(views.id, id),
      });

      if (!view) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (projectId && projectId !== view.projectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot move view to a different project",
        });
      }

      const membership = await ctx.db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, view.projectId),
          eq(projectMembers.userId, ctx.session.user.id),
        ),
      });

      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const isCurrentWorkspace = view.ownerUserId === null;
      const isCallerManager = membership.role !== "member";

      // If updating a Workspace View definition:
      if (isCurrentWorkspace && !isCallerManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can modify Workspace Views",
        });
      }

      // If updating a personal view:
      if (!isCurrentWorkspace && view.ownerUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify another user's personal view",
        });
      }

      // Scope changes
      const isScopeChanging =
        ownerUserId !== undefined ||
        scope !== undefined ||
        isWorkspaceView !== undefined;

      let nextOwnerUserId: string | null | undefined = undefined;

      if (isScopeChanging) {
        const wantsWorkspace =
          scope === "workspace" ||
          isWorkspaceView === true ||
          ownerUserId === null;

        if (wantsWorkspace) {
          // Moving into Workspace View
          if (!isCallerManager) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Only admins and owners can move views to Workspace Views",
            });
          }
          nextOwnerUserId = null;
        } else {
          // Moving into or remaining Personal View
          const targetUser = ownerUserId ?? ctx.session.user.id;
          if (targetUser !== ctx.session.user.id && !isCallerManager) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot assign personal view to another user",
            });
          }

          const targetMembership = await ctx.db.query.projectMembers.findFirst({
            where: and(
              eq(projectMembers.projectId, view.projectId),
              eq(projectMembers.userId, targetUser),
            ),
          });
          if (!targetMembership) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Target user is not a member of this project",
            });
          }

          nextOwnerUserId = targetUser;
        }
      }

      const updateData: Partial<typeof views.$inferInsert> = {};
      if (name !== undefined) updateData.name = name;
      if (icon !== undefined) updateData.icon = icon;
      if (configuration !== undefined) updateData.configuration = configuration;
      if (nextOwnerUserId !== undefined)
        updateData.ownerUserId = nextOwnerUserId;
      updateData.updatedAt = new Date();

      const [updated] = await ctx.db
        .update(views)
        .set(updateData)
        .where(eq(views.id, id))
        .returning();

      return updated!;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.query.views.findFirst({
        where: eq(views.id, input.id),
      });

      if (!view) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (input.projectId && input.projectId !== view.projectId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const membership = await ctx.db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, view.projectId),
          eq(projectMembers.userId, ctx.session.user.id),
        ),
      });

      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const isWorkspace = view.ownerUserId === null;
      const isCallerManager = membership.role !== "member";

      if (isWorkspace && !isCallerManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can delete Workspace Views",
        });
      }

      if (!isWorkspace && view.ownerUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete another user's personal view",
        });
      }

      await ctx.db.delete(views).where(eq(views.id, input.id));

      return { success: true };
    }),
});
