import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { projectMembers, projects, user, views } from "@/server/db/schema";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

const projectId = "00000000-0000-4000-8000-000000000001";
const secondProjectId = "00000000-0000-4000-8000-000000000002";
const now = new Date();

type Role = "owner" | "admin" | "member";

async function createProject(id: string, name: string) {
  await db.insert(projects).values({ id, name });
}

async function createUser(id: string, name: string) {
  await db.insert(user).values({
    id,
    name,
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
}

async function addMember(project: string, userId: string, role: Role) {
  await db.insert(projectMembers).values({ projectId: project, userId, role });
}

function callerFor(id: string, name: string) {
  return createTestCaller({
    ...testSession,
    user: {
      ...testSession.user,
      id,
      name,
      email: `${id}@example.com`,
    },
  });
}

describe("viewRouter", () => {
  beforeEach(async () => {
    // Project 1:
    // testSession.user (owner)
    // admin-user (admin)
    // member-user (member)
    // other-member (member)
    // outsider (no project)
    await createProject(projectId, "Test Project");
    await createUser("admin-user", "Admin User");
    await createUser("member-user", "Member User");
    await createUser("other-member", "Other Member");
    await createUser("outsider", "Outsider");

    await addMember(projectId, testSession.user.id, "owner");
    await addMember(projectId, "admin-user", "admin");
    await addMember(projectId, "member-user", "member");
    await addMember(projectId, "other-member", "member");
  });

  describe("authentication", () => {
    it("rejects unauthenticated callers on all procedures", async () => {
      const caller = createTestCaller(null).view;
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await expect(caller.list({ projectId })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(caller.getById({ id: fakeId })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(
        caller.create({
          projectId,
          name: "View",
          icon: "layout-dashboard",
          configuration: {},
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        caller.update({
          id: fakeId,
          name: "Updated",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(caller.delete({ id: fakeId })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("input validation", () => {
    it("rejects malformed inputs and empty names", async () => {
      const caller = callerFor("member-user", "Member User").view;

      await expect(
        caller.list({ projectId: "not-a-uuid" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        caller.create({
          projectId,
          name: "   ",
          icon: "layout-dashboard",
          configuration: {},
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        caller.create({
          projectId,
          name: "Test View",
          // @ts-expect-error invalid icon key
          icon: "invalid-icon-name",
          configuration: {},
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        caller.create({
          projectId,
          name: "Test View",
          icon: "layout-dashboard",
          // @ts-expect-error invalid groupBy
          configuration: { groupBy: "invalid_field" },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        caller.create({
          projectId,
          name: "Test View",
          icon: "layout-dashboard",
          // @ts-expect-error invalid sort
          configuration: { sort: "invalid_sort" },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        caller.update({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("list & default views", () => {
    it("provides the default status (Board) and by-person views as Workspace Views", async () => {
      const caller = callerFor("member-user", "Member User").view;
      const list = await caller.list({ projectId });

      expect(list.length).toBeGreaterThanOrEqual(2);

      const boardView = list.find((v) => v.name === "Board");
      expect(boardView).toBeDefined();
      expect(boardView?.ownerUserId).toBeNull();
      expect(boardView?.icon).toBe("layout-dashboard");
      expect(boardView?.configuration).toMatchObject({
        groupBy: "status",
      });

      const personView = list.find((v) => v.name === "By person");
      expect(personView).toBeDefined();
      expect(personView?.ownerUserId).toBeNull();
      expect(personView?.icon).toBe("users");
      expect(personView?.configuration).toMatchObject({
        rowGroup: "assignee",
      });

      // Calling list again when defaults already exist should succeed idempotently
      const secondList = await caller.list({ projectId });
      expect(secondList.length).toBe(list.length);
    });

    it("seeds missing default views if only one exists", async () => {
      // Seed only the Board view
      await db.insert(views).values({
        projectId,
        ownerUserId: null,
        name: "Board",
        icon: "layout-dashboard",
        configuration: {},
      });

      const caller = callerFor("member-user", "Member User").view;
      const list = await caller.list({ projectId });

      expect(list.find((v) => v.name === "Board")).toBeDefined();
      expect(list.find((v) => v.name === "By person")).toBeDefined();
    });

    it("rejects non-members calling list", async () => {
      const caller = callerFor("outsider", "Outsider").view;
      await expect(caller.list({ projectId })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("returns accessible Workspace Views and the caller's own My Views, but hides other users' My Views", async () => {
      const memberCaller = callerFor("member-user", "Member User").view;
      const otherCaller = callerFor("other-member", "Other Member").view;

      // member-user creates a personal view
      const memberPersonalView = await memberCaller.create({
        projectId,
        name: "Member Personal View",
        icon: "kanban",
        configuration: {
          columns: ["todo", "done"],
          groupBy: "status",
          filters: { column: "todo" },
          sort: "storyPoints",
        },
      });

      // other-member creates a personal view
      const otherPersonalView = await otherCaller.create({
        projectId,
        name: "Other Personal View",
        icon: "list",
        configuration: {
          columns: ["in_progress"],
          groupBy: "status",
        },
      });

      // Member lists views
      const memberViews = await memberCaller.list({ projectId });
      const memberViewIds = memberViews.map((v) => v.id);

      expect(memberViewIds).toContain(memberPersonalView.id);
      expect(memberViewIds).not.toContain(otherPersonalView.id);

      // Other member lists views
      const otherViews = await otherCaller.list({ projectId });
      const otherViewIds = otherViews.map((v) => v.id);

      expect(otherViewIds).toContain(otherPersonalView.id);
      expect(otherViewIds).not.toContain(memberPersonalView.id);
    });
  });

  describe("create", () => {
    it("allows a member to create their own personal view with presentation, filters, and sorting", async () => {
      const caller = callerFor("member-user", "Member User").view;

      const created = await caller.create({
        projectId,
        name: "Sprint Backlog",
        icon: "calendar-days",
        configuration: {
          columns: ["backlog", "todo", "in_progress"],
          groupBy: "status",
          rowGroup: "assignee",
          filters: {
            sprintNumber: "2026-1",
            assigneeId: "member-user",
          },
          sort: "storyPoints",
        },
      });

      expect(created.name).toBe("Sprint Backlog");
      expect(created.icon).toBe("calendar-days");
      expect(created.ownerUserId).toBe("member-user");
      expect(created.projectId).toBe(projectId);
      expect(created.configuration).toEqual({
        columns: ["backlog", "todo", "in_progress"],
        groupBy: "status",
        rowGroup: "assignee",
        filters: {
          sprintNumber: "2026-1",
          assigneeId: "member-user",
        },
        sort: "storyPoints",
      });
    });

    it("forbids regular members from creating Workspace Views", async () => {
      const caller = callerFor("member-user", "Member User").view;

      await expect(
        caller.create({
          projectId,
          name: "Global Board",
          icon: "layout-dashboard",
          configuration: {},
          scope: "workspace",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        caller.create({
          projectId,
          name: "Global Board 2",
          icon: "layout-dashboard",
          configuration: {},
          ownerUserId: null,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        caller.create({
          projectId,
          name: "Global Board 3",
          icon: "layout-dashboard",
          configuration: {},
          isWorkspaceView: true,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("forbids regular members from assigning views to other users", async () => {
      const caller = callerFor("member-user", "Member User").view;

      await expect(
        caller.create({
          projectId,
          name: "Hijacked View",
          icon: "layout-dashboard",
          configuration: {},
          ownerUserId: "other-member",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("allows project admins and owners to create Workspace Views", async () => {
      const adminCaller = callerFor("admin-user", "Admin User").view;
      const ownerCaller = createTestCaller().view;

      const adminWorkspaceView = await adminCaller.create({
        projectId,
        name: "Admin Workspace View",
        icon: "table",
        configuration: {
          columns: ["todo", "done"],
          groupBy: "status",
        },
        scope: "workspace",
      });

      expect(adminWorkspaceView.ownerUserId).toBeNull();

      const ownerWorkspaceView = await ownerCaller.create({
        projectId,
        name: "Owner Workspace View",
        icon: "bar-chart-3",
        configuration: {
          columns: ["backlog"],
          groupBy: "sprint",
        },
        ownerUserId: null,
      });

      expect(ownerWorkspaceView.ownerUserId).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns Workspace Views and caller's own My Views", async () => {
      const memberCaller = callerFor("member-user", "Member User").view;
      const viewsList = await memberCaller.list({ projectId });
      const boardView = viewsList.find((v) => v.name === "Board")!;

      // Member can get workspace view
      const fetchedBoard = await memberCaller.getById({
        id: boardView.id,
        projectId,
      });
      expect(fetchedBoard.id).toBe(boardView.id);

      // Member can get own personal view
      const personal = await memberCaller.create({
        projectId,
        name: "Personal",
        icon: "user",
        configuration: {},
      });

      const fetchedPersonal = await memberCaller.getById({ id: personal.id });
      expect(fetchedPersonal.id).toBe(personal.id);
    });

    it("throws NOT_FOUND when guessing another person's private view ID", async () => {
      const memberCaller = callerFor("member-user", "Member User").view;
      const otherCaller = callerFor("other-member", "Other Member").view;

      const privateView = await otherCaller.create({
        projectId,
        name: "Private View",
        icon: "user",
        configuration: {},
      });

      await expect(
        memberCaller.getById({ id: privateView.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND when guessing a view ID from another project", async () => {
      await createProject(secondProjectId, "Second Project");
      await addMember(secondProjectId, "other-member", "owner");

      const secondProjectCaller = callerFor(
        "other-member",
        "Other Member",
      ).view;
      const secondProjectView = await secondProjectCaller.create({
        projectId: secondProjectId,
        name: "Second Project View",
        icon: "layout-dashboard",
        configuration: {},
        scope: "workspace",
      });

      const memberCaller = callerFor("member-user", "Member User").view;
      await expect(
        memberCaller.getById({ id: secondProjectView.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      // Cross-project with mismatched projectId option
      await expect(
        memberCaller.getById({
          id: secondProjectView.id,
          projectId,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND for non-existent view IDs", async () => {
      const caller = callerFor("member-user", "Member User").view;
      await expect(
        caller.getById({ id: "00000000-0000-0000-0000-000000000000" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("update", () => {
    it("allows a member to update their own personal view", async () => {
      const caller = callerFor("member-user", "Member User").view;

      const created = await caller.create({
        projectId,
        name: "Initial Name",
        icon: "list",
        configuration: { columns: ["todo"] },
      });

      const updated = await caller.update({
        id: created.id,
        name: "Updated Name",
        icon: "kanban",
        configuration: {
          columns: ["todo", "done"],
          groupBy: "status",
          sort: { field: "lastMovedAt", direction: "desc" },
        },
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.icon).toBe("kanban");
      expect(updated.configuration).toEqual({
        columns: ["todo", "done"],
        groupBy: "status",
        sort: { field: "lastMovedAt", direction: "desc" },
      });
      expect(updated.ownerUserId).toBe("member-user");
    });

    it("throws NOT_FOUND when updating non-existent view or caller is non-member", async () => {
      const memberCaller = callerFor("member-user", "Member User").view;
      const outsiderCaller = callerFor("outsider", "Outsider").view;

      await expect(
        memberCaller.update({
          id: "00000000-0000-0000-0000-000000000000",
          name: "Non-existent",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      const view = await memberCaller.create({
        projectId,
        name: "View",
        icon: "user",
        configuration: {},
      });

      await expect(
        outsiderCaller.update({
          id: view.id,
          name: "Attempted by outsider",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("forbids regular members from modifying Workspace Views", async () => {
      const adminCaller = callerFor("admin-user", "Admin User").view;
      const memberCaller = callerFor("member-user", "Member User").view;

      const workspaceView = await adminCaller.create({
        projectId,
        name: "Workspace View",
        icon: "table",
        configuration: {},
        scope: "workspace",
      });

      await expect(
        memberCaller.update({
          id: workspaceView.id,
          name: "Hacked Workspace View",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        memberCaller.update({
          id: workspaceView.id,
          scope: "personal",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("forbids regular members from modifying another user's personal view", async () => {
      const ownerOfView = callerFor("member-user", "Member User").view;
      const otherUser = callerFor("other-member", "Other Member").view;

      const personalView = await ownerOfView.create({
        projectId,
        name: "My Personal View",
        icon: "user",
        configuration: {},
      });

      await expect(
        otherUser.update({
          id: personalView.id,
          name: "Attempted Edit",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("forbids regular members from moving a view into Workspace Views or reassigning to others", async () => {
      const memberCaller = callerFor("member-user", "Member User").view;

      const personalView = await memberCaller.create({
        projectId,
        name: "Personal View",
        icon: "user",
        configuration: {},
      });

      await expect(
        memberCaller.update({
          id: personalView.id,
          scope: "workspace",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        memberCaller.update({
          id: personalView.id,
          ownerUserId: null,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        memberCaller.update({
          id: personalView.id,
          ownerUserId: "other-member",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("allows admins/owners to update Workspace Views and change scope", async () => {
      const adminCaller = callerFor("admin-user", "Admin User").view;

      // Create workspace view
      const workspaceView = await adminCaller.create({
        projectId,
        name: "Original WS View",
        icon: "table",
        configuration: {},
        scope: "workspace",
      });

      // Update definition
      const updatedDefinition = await adminCaller.update({
        id: workspaceView.id,
        name: "Updated WS View",
        icon: "board",
      });
      expect(updatedDefinition.name).toBe("Updated WS View");
      expect(updatedDefinition.icon).toBe("board");

      // Admin moves workspace view to personal view
      const demotedView = await adminCaller.update({
        id: workspaceView.id,
        scope: "personal",
      });
      expect(demotedView.ownerUserId).toBe("admin-user");

      // Admin assigns personal view to another project member
      const reassigned = await adminCaller.update({
        id: workspaceView.id,
        ownerUserId: "member-user",
      });
      expect(reassigned.ownerUserId).toBe("member-user");

      // Admin moves personal view to Workspace View
      const personalView = await adminCaller.create({
        projectId,
        name: "Admin Personal",
        icon: "user",
        configuration: {},
      });
      expect(personalView.ownerUserId).toBe("admin-user");

      const promotedView = await adminCaller.update({
        id: personalView.id,
        scope: "workspace",
      });
      expect(promotedView.ownerUserId).toBeNull();
    });

    it("rejects assigning personal view to a user outside the project", async () => {
      const adminCaller = callerFor("admin-user", "Admin User").view;

      const view = await adminCaller.create({
        projectId,
        name: "View",
        icon: "table",
        configuration: {},
        scope: "personal",
      });

      await expect(
        adminCaller.update({
          id: view.id,
          ownerUserId: "outsider",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects moving a view to a different project", async () => {
      const adminCaller = callerFor("admin-user", "Admin User").view;
      await createProject(secondProjectId, "Second Project");

      const view = await adminCaller.create({
        projectId,
        name: "View",
        icon: "table",
        configuration: {},
        scope: "workspace",
      });

      await expect(
        adminCaller.update({
          id: view.id,
          projectId: secondProjectId,
          name: "Moved",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("delete", () => {
    it("allows a member to delete their own personal view", async () => {
      const caller = callerFor("member-user", "Member User").view;

      const created = await caller.create({
        projectId,
        name: "To Delete",
        icon: "user",
        configuration: {},
      });

      await expect(
        caller.delete({ id: created.id, projectId }),
      ).resolves.toEqual({
        success: true,
      });

      expect(
        await db.query.views.findFirst({
          where: eq(views.id, created.id),
        }),
      ).toBeUndefined();
    });

    it("throws NOT_FOUND when view does not exist, projectId mismatches, or caller is outsider", async () => {
      const memberCaller = callerFor("member-user", "Member User").view;
      const outsiderCaller = callerFor("outsider", "Outsider").view;

      await expect(
        memberCaller.delete({ id: "00000000-0000-0000-0000-000000000000" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      const view = await memberCaller.create({
        projectId,
        name: "Delete Check",
        icon: "user",
        configuration: {},
      });

      await expect(
        memberCaller.delete({
          id: view.id,
          projectId: "00000000-0000-4000-8000-000000000099",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      await expect(
        outsiderCaller.delete({ id: view.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("forbids regular members from deleting Workspace Views", async () => {
      const adminCaller = callerFor("admin-user", "Admin User").view;
      const memberCaller = callerFor("member-user", "Member User").view;

      const workspaceView = await adminCaller.create({
        projectId,
        name: "Workspace View",
        icon: "table",
        configuration: {},
        scope: "workspace",
      });

      await expect(
        memberCaller.delete({ id: workspaceView.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("forbids regular members from deleting another user's personal view", async () => {
      const ownerCaller = callerFor("member-user", "Member User").view;
      const otherCaller = callerFor("other-member", "Other Member").view;

      const personalView = await ownerCaller.create({
        projectId,
        name: "Personal",
        icon: "user",
        configuration: {},
      });

      await expect(
        otherCaller.delete({ id: personalView.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("allows admins/owners to delete Workspace Views", async () => {
      const adminCaller = callerFor("admin-user", "Admin User").view;

      const workspaceView = await adminCaller.create({
        projectId,
        name: "Admin WS View",
        icon: "table",
        configuration: {},
        scope: "workspace",
      });

      await expect(
        adminCaller.delete({ id: workspaceView.id }),
      ).resolves.toEqual({ success: true });

      expect(
        await db.query.views.findFirst({
          where: eq(views.id, workspaceView.id),
        }),
      ).toBeUndefined();
    });
  });

  describe("cleanup & cascade rules", () => {
    it("cascades deletion of all views when project is deleted", async () => {
      const ownerCaller = createTestCaller().project;
      const memberCaller = callerFor("member-user", "Member User").view;

      // Create a workspace view and a personal view in project
      await callerFor("admin-user", "Admin User").view.create({
        projectId,
        name: "WS View",
        icon: "layout-dashboard",
        configuration: {},
        scope: "workspace",
      });

      await memberCaller.create({
        projectId,
        name: "Personal View",
        icon: "user",
        configuration: {},
      });

      const beforeViews = await db.query.views.findMany({
        where: eq(views.projectId, projectId),
      });
      expect(beforeViews.length).toBeGreaterThanOrEqual(2);

      // Owner deletes project
      await ownerCaller.delete({ projectId });

      const afterViews = await db.query.views.findMany({
        where: eq(views.projectId, projectId),
      });
      expect(afterViews).toHaveLength(0);
    });

    it("cascades personal views when their user is deleted", async () => {
      const memberCaller = callerFor("member-user", "Member User").view;

      const personalView = await memberCaller.create({
        projectId,
        name: "Member View",
        icon: "user",
        configuration: {},
      });

      expect(
        await db.query.views.findFirst({
          where: eq(views.id, personalView.id),
        }),
      ).toBeDefined();

      // Delete user row
      await db.delete(user).where(eq(user.id, "member-user"));

      expect(
        await db.query.views.findFirst({
          where: eq(views.id, personalView.id),
        }),
      ).toBeUndefined();
    });

    it("deletes a user's personal views when their membership is removed, while keeping user account, workspace views, and other project views", async () => {
      await createProject(secondProjectId, "Second Project");
      await addMember(secondProjectId, "member-user", "member");

      const memberCaller = callerFor("member-user", "Member User").view;
      const adminCaller = callerFor("admin-user", "Admin User");

      // Personal view in Project 1
      const p1Personal = await memberCaller.create({
        projectId,
        name: "P1 Personal View",
        icon: "user",
        configuration: {},
      });

      // Workspace view in Project 1
      const p1Workspace = await adminCaller.view.create({
        projectId,
        name: "P1 Workspace View",
        icon: "table",
        configuration: {},
        scope: "workspace",
      });

      // Personal view in Project 2
      const p2Personal = await memberCaller.create({
        projectId: secondProjectId,
        name: "P2 Personal View",
        icon: "user",
        configuration: {},
      });

      // Admin removes member-user from Project 1
      await adminCaller.member.remove({
        projectId,
        userId: "member-user",
      });

      // P1 Personal view is deleted
      expect(
        await db.query.views.findFirst({
          where: eq(views.id, p1Personal.id),
        }),
      ).toBeUndefined();

      // P1 Workspace view survives
      expect(
        await db.query.views.findFirst({
          where: eq(views.id, p1Workspace.id),
        }),
      ).toBeDefined();

      // User account survives
      expect(
        await db.query.user.findFirst({
          where: eq(user.id, "member-user"),
        }),
      ).toBeDefined();

      // P2 Personal view survives
      expect(
        await db.query.views.findFirst({
          where: eq(views.id, p2Personal.id),
        }),
      ).toBeDefined();
    });
  });
});
