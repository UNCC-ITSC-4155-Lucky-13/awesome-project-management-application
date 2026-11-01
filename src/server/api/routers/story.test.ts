import { describe, expect, it } from "vitest";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";
import { projects, projectMembers, user } from "@/server/db/schema";

describe("storyRouter", () => {
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

  it("rejects unauthenticated callers", async () => {
    await expect(
      createTestCaller(null).story.list({ projectId: "123" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("creates a story with valid data and assignees", async () => {
    const project = await setupProject();

    // Create a second user to assign
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

    expect(story.name).toBe("Test Story");
    expect(story.sprintNumber).toBe("2026-1");

    // Verify assignee was inserted
    const assigneeRecord = await db.query.storyAssignees.findFirst({
      where: (sa, { eq }) => eq(sa.storyId, story.id),
    });
    expect(assigneeRecord).toBeDefined();
    expect(assigneeRecord?.userId).toBe(assigneeId);
  });

  it("rejects invalid sprint numbers", async () => {
    const project = await setupProject();
    await expect(
      createTestCaller().story.create({
        projectId: project.id,
        name: "Bad Sprint",
        sprintNumber: "2026_1", // Invalid format
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

    const oldDate = story.lastMovedAt;

    await new Promise((r) => setTimeout(r, 10));

    const updated = await createTestCaller().story.update({
      id: story.id,
      column: "todo",
    });

    expect(updated!.column).toBe("todo");
    expect(updated!.lastMovedAt.getTime()).toBeGreaterThan(oldDate.getTime());
  });
});
