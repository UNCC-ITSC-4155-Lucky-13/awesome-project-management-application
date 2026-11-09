import { describe, expect, it } from "vitest";

import { projectMembers, projects, stories, user } from "@/server/db/schema";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

const setupProject = async () => {
  const [project] = await db
    .insert(projects)
    .values({ name: "Test Project" })
    .returning();
  await db.insert(projectMembers).values({
    projectId: project!.id,
    userId: testSession.user.id,
    role: "owner",
  });
  return project!;
};

describe("storyRouter", () => {
  describe("create", () => {
    it("rejects unauthenticated callers", async () => {
      await expect(
        createTestCaller(null).story.create({
          projectId: "00000000-0000-0000-0000-000000000000",
          name: "Test",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects non-members with FORBIDDEN", async () => {
      const [otherProject] = await db
        .insert(projects)
        .values({ name: "Other" })
        .returning();

      await expect(
        createTestCaller().story.create({
          projectId: otherProject!.id,
          name: "Test",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("creates a story with valid data and assignees", async () => {
      const project = await setupProject();
      const assigneeId = "test-user-2";
      await db.insert(user).values({
        id: assigneeId,
        name: "User 2",
        email: "user2@example.com",
        emailVerified: true,
      });

      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Test Story",
        sprintNumber: "2026-1",
        assigneeIds: [assigneeId],
      });

      expect(story!.name).toBe("Test Story");
      expect(story!.sprintNumber).toBe("2026-1");

      const assigneeRecord = await db.query.storyAssignees.findFirst({
        where: (sa, { eq }) => eq(sa.storyId, story!.id),
      });
      expect(assigneeRecord?.userId).toBe(assigneeId);
    });

    it("rejects invalid sprint numbers", async () => {
      const project = await setupProject();
      await expect(
        createTestCaller().story.create({
          projectId: project.id,
          name: "Bad Sprint",
          sprintNumber: "2026_1",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("update", () => {
    it("rejects unauthenticated callers", async () => {
      await expect(
        createTestCaller(null).story.update({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("throws NOT_FOUND when the story does not exist", async () => {
      await expect(
        createTestCaller().story.update({
          id: "00000000-0000-0000-0000-000000000000",
          name: "Does not exist",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN when the user is not a member", async () => {
      const [otherProject] = await db
        .insert(projects)
        .values({ name: "Other" })
        .returning();
      const [story] = await db
        .insert(stories)
        .values({
          projectId: otherProject!.id,
          creatorId: testSession.user.id,
          name: "Existing",
        })
        .returning();

      await expect(
        createTestCaller().story.update({
          id: story!.id,
          name: "New name",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects an empty update", async () => {
      const project = await setupProject();
      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Empty Update",
      });

      await expect(
        createTestCaller().story.update({
          id: story!.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("updates lastMovedAt when the column changes", async () => {
      const project = await setupProject();
      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Move Me",
        column: "backlog",
      });

      const oldDate = story!.lastMovedAt;

      await new Promise((r) => setTimeout(r, 10));

      const updated = await createTestCaller().story.update({
        id: story!.id,
        column: "todo",
      });

      expect(updated.column).toBe("todo");
      expect(updated.lastMovedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it("does not update lastMovedAt when the column is unchanged", async () => {
      const project = await setupProject();
      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Stays",
        column: "backlog",
      });

      const oldDate = story!.lastMovedAt;

      const updated = await createTestCaller().story.update({
        id: story!.id,
        name: "Renamed",
      });

      expect(updated.name).toBe("Renamed");
      expect(updated.lastMovedAt.getTime()).toBe(oldDate.getTime());
    });

    it("replaces assignees when assigneeIds is provided", async () => {
      const project = await setupProject();
      await db.insert(user).values([
        {
          id: "user-a",
          name: "A",
          email: "a@example.com",
          emailVerified: true,
        },
        {
          id: "user-b",
          name: "B",
          email: "b@example.com",
          emailVerified: true,
        },
      ]);

      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Reassign",
        assigneeIds: ["user-a"],
      });

      await createTestCaller().story.update({
        id: story!.id,
        assigneeIds: ["user-b"],
      });

      const assignees = await db.query.storyAssignees.findMany({
        where: (sa, { eq }) => eq(sa.storyId, story!.id),
      });

      expect(assignees).toHaveLength(1);
      expect(assignees[0]?.userId).toBe("user-b");
    });

    it("clears assignees when assigneeIds is an empty array", async () => {
      const project = await setupProject();
      await db.insert(user).values({
        id: "user-c",
        name: "C",
        email: "c@example.com",
        emailVerified: true,
      });

      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Clear assignees",
        assigneeIds: ["user-c"],
      });

      await createTestCaller().story.update({
        id: story!.id,
        assigneeIds: [],
      });

      const assignees = await db.query.storyAssignees.findMany({
        where: (sa, { eq }) => eq(sa.storyId, story!.id),
      });

      expect(assignees).toHaveLength(0);
    });

    it("rejects invalid sprint numbers", async () => {
      const project = await setupProject();
      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Test",
      });

      await expect(
        createTestCaller().story.update({
          id: story!.id,
          sprintNumber: "2026_1",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("delete", () => {
    it("rejects unauthenticated callers", async () => {
      await expect(
        createTestCaller(null).story.delete({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("throws NOT_FOUND when the story does not exist", async () => {
      await expect(
        createTestCaller().story.delete({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN for non-members", async () => {
      const [otherProject] = await db
        .insert(projects)
        .values({ name: "Other" })
        .returning();
      const [story] = await db
        .insert(stories)
        .values({
          projectId: otherProject!.id,
          creatorId: testSession.user.id,
          name: "Existing",
        })
        .returning();

      await expect(
        createTestCaller().story.delete({ id: story!.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("deletes the story and cascades to assignees", async () => {
      const project = await setupProject();
      await db.insert(user).values({
        id: "user-d",
        name: "D",
        email: "d@example.com",
        emailVerified: true,
      });

      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Delete Me",
        assigneeIds: ["user-d"],
      });

      const result = await createTestCaller().story.delete({ id: story!.id });
      expect(result.success).toBe(true);

      const stillThere = await db.query.stories.findFirst({
        where: (s, { eq }) => eq(s.id, story!.id),
      });
      expect(stillThere).toBeUndefined();

      const assignees = await db.query.storyAssignees.findMany({
        where: (sa, { eq }) => eq(sa.storyId, story!.id),
      });
      expect(assignees).toHaveLength(0);
    });
  });

  describe("list", () => {
    it("rejects unauthenticated callers", async () => {
      await expect(
        createTestCaller(null).story.list({
          projectId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("throws FORBIDDEN for non-members", async () => {
      const [otherProject] = await db
        .insert(projects)
        .values({ name: "Other" })
        .returning();

      await expect(
        createTestCaller().story.list({ projectId: otherProject!.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("returns all stories for a project", async () => {
      const project = await setupProject();
      await createTestCaller().story.create({
        projectId: project.id,
        name: "Story 1",
      });
      await createTestCaller().story.create({
        projectId: project.id,
        name: "Story 2",
      });

      const list = await createTestCaller().story.list({
        projectId: project.id,
      });

      expect(list).toHaveLength(2);
    });

    it("filters by sprintNumber", async () => {
      const project = await setupProject();
      await createTestCaller().story.create({
        projectId: project.id,
        name: "Sprint A",
        sprintNumber: "2026-1",
      });
      await createTestCaller().story.create({
        projectId: project.id,
        name: "Sprint B",
        sprintNumber: "2026-2",
      });

      const list = await createTestCaller().story.list({
        projectId: project.id,
        sprintNumber: "2026-1",
      });

      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe("Sprint A");
    });

    it("filters by column", async () => {
      const project = await setupProject();
      await createTestCaller().story.create({
        projectId: project.id,
        name: "In Backlog",
        column: "backlog",
      });
      await createTestCaller().story.create({
        projectId: project.id,
        name: "Done",
        column: "done",
      });

      const backlog = await createTestCaller().story.list({
        projectId: project.id,
        column: "backlog",
      });

      expect(backlog).toHaveLength(1);
      expect(backlog[0]?.name).toBe("In Backlog");
    });

    it("filters by assigneeId", async () => {
      const project = await setupProject();
      await db.insert(user).values({
        id: "user-filter",
        name: "Filter",
        email: "filter@example.com",
        emailVerified: true,
      });

      await createTestCaller().story.create({
        projectId: project.id,
        name: "Assigned",
        assigneeIds: ["user-filter"],
      });
      await createTestCaller().story.create({
        projectId: project.id,
        name: "Unassigned",
      });

      const list = await createTestCaller().story.list({
        projectId: project.id,
        assigneeId: "user-filter",
      });

      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe("Assigned");
    });

    it("sorts by storyPoints", async () => {
      const project = await setupProject();
      await createTestCaller().story.create({
        projectId: project.id,
        name: "Low",
        storyPoints: 1,
      });
      await createTestCaller().story.create({
        projectId: project.id,
        name: "High",
        storyPoints: 10,
      });

      const list = await createTestCaller().story.list({
        projectId: project.id,
        sort: "storyPoints",
      });

      expect(list[0]?.name).toBe("High");
      expect(list[1]?.name).toBe("Low");
    });
  });

  describe("getById", () => {
    it("rejects unauthenticated callers", async () => {
      await expect(
        createTestCaller(null).story.getById({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("throws NOT_FOUND if the story doesn't exist", async () => {
      await expect(
        createTestCaller().story.getById({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns the story with assignees", async () => {
      const project = await setupProject();
      const story = await createTestCaller().story.create({
        projectId: project.id,
        name: "Get Me",
      });

      const fetched = await createTestCaller().story.getById({ id: story!.id });
      expect(fetched.name).toBe("Get Me");
      expect(fetched.assignees).toBeDefined();
    });
  });
});
