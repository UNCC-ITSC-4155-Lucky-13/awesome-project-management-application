import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  projectInvites,
  projectMembers,
  projects,
  user,
} from "@/server/db/schema";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

const projectId = "00000000-0000-4000-8000-000000000001";
const sprintStartDate = new Date("2026-01-05T00:00:00Z");
const expectedSprintDefaults = { sprintDuration: 2, sprintStartDate: null };

async function seedProject(role?: "owner" | "admin" | "member") {
  await db.insert(projects).values({ id: projectId, name: "Project" });
  if (role) {
    await db.insert(projectMembers).values({
      projectId,
      userId: testSession.user.id,
      role,
    });
  }
}

describe("projectRouter", () => {
  it("creates a project with standard defaults and the caller as owner", async () => {
    const project = await createTestCaller().project.create({
      name: " Project ",
    });

    expect(project).toMatchObject({
      name: "Project",
      description: null,
      ...expectedSprintDefaults,
    });
    expect(await db.query.projects.findFirst()).toEqual(project);
    expect(await db.query.projectMembers.findMany()).toEqual([
      { projectId: project.id, userId: testSession.user.id, role: "owner" },
    ]);
  });

  it("applies all initial sprint settings and the description", async () => {
    const project = await createTestCaller().project.create({
      name: "Custom",
      description: "Custom description",
      settings: { sprintDuration: 3, sprintStartDate },
    });

    expect(project).toMatchObject({
      name: "Custom",
      description: "Custom description",
      sprintDuration: 3,
      sprintStartDate,
    });
  });

  it("rolls back project creation if assigning the owner fails", async () => {
    const caller = createTestCaller({
      ...testSession,
      user: { ...testSession.user, id: "missing-user" },
    });

    await expect(caller.project.create({ name: "Orphan" })).rejects.toThrow();
    expect(await db.query.projects.findMany()).toEqual([]);
    expect(await db.query.projectMembers.findMany()).toEqual([]);
  });

  it("lists only the caller's projects and returns their role", async () => {
    const caller = createTestCaller().project;
    await expect(caller.list()).resolves.toEqual([]);
    await seedProject("member");
    await db.insert(projects).values({ name: "Unrelated project" });

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    await expect(caller.list()).resolves.toEqual([project]);
    await expect(caller.getById({ projectId })).resolves.toEqual({
      ...project,
      role: "member",
    });
  });

  it("does not grant access through another user's membership", async () => {
    const otherUser = {
      ...testSession.user,
      id: "other-user",
      email: "other@example.com",
    };
    await db.insert(user).values(otherUser);
    const otherCaller = createTestCaller({
      ...testSession,
      user: otherUser,
      session: { ...testSession.session, userId: otherUser.id },
    });
    const project = await otherCaller.project.create({ name: "Private" });
    const caller = createTestCaller().project;

    await expect(caller.list()).resolves.toEqual([]);
    await expect(
      caller.getById({ projectId: project.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.update({ projectId: project.id, settings: { name: "Forbidden" } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.delete({ projectId: project.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.query.projects.findFirst()).toEqual(project);
  });

  it.each(["owner", "admin"] as const)(
    "allows %s to update all project settings",
    async (role) => {
      await seedProject(role);
      const settings = {
        name: "Updated",
        description: "Description",
        sprintDuration: 4,
        sprintStartDate,
      };

      const updated = await createTestCaller().project.update({
        projectId,
        settings: { ...settings, name: " Updated " },
      });

      expect(updated).toMatchObject({ id: projectId, ...settings });
      expect(await db.query.projects.findFirst()).toEqual(updated);
    },
  );

  it("preserves omitted settings and accepts null updates", async () => {
    const caller = createTestCaller().project;
    const project = await caller.create({
      name: "Original",
      description: "Description",
      settings: { sprintDuration: 3, sprintStartDate },
    });

    await expect(
      caller.update({
        projectId: project.id,
        settings: { sprintDuration: 4, name: undefined },
      }),
    ).resolves.toMatchObject({
      name: "Original",
      description: "Description",
      sprintDuration: 4,
      sprintStartDate,
    });
    await expect(
      caller.update({ projectId: project.id, settings: { description: null } }),
    ).resolves.toMatchObject({ description: null, sprintStartDate });
    await expect(
      caller.update({
        projectId: project.id,
        settings: { sprintStartDate: null },
      }),
    ).resolves.toMatchObject({ description: null, sprintStartDate: null });
  });

  it("rejects an empty settings update", async () => {
    await seedProject("owner");
    const before = await db.query.projects.findFirst();

    await expect(
      createTestCaller().project.update({ projectId, settings: {} }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await db.query.projects.findFirst()).toEqual(before);
  });

  it("forbids members from updating project settings", async () => {
    await seedProject("member");
    const before = await db.query.projects.findFirst();

    await expect(
      createTestCaller().project.update({
        projectId,
        settings: { name: "Forbidden" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.query.projects.findFirst()).toEqual(before);
  });

  it.each(["member", "admin"] as const)(
    "forbids deletion for role %s",
    async (role) => {
      await seedProject(role);

      await expect(
        createTestCaller().project.delete({ projectId }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(await db.query.projects.findMany()).toHaveLength(1);
    },
  );

  it("lets the owner delete a project and cascades to memberships and invites", async () => {
    await seedProject("owner");
    await db.insert(projectInvites).values({
      projectId,
      githubUsername: "octocat",
      createdBy: testSession.user.id,
    });
    const [unrelated] = await db
      .insert(projects)
      .values({ name: "Keep" })
      .returning();

    await expect(
      createTestCaller().project.delete({ projectId }),
    ).resolves.toEqual({
      success: true,
    });
    expect(await db.query.projects.findMany()).toEqual([unrelated]);
    expect(await db.query.projectMembers.findMany()).toEqual([]);
    expect(await db.query.projectInvites.findMany()).toEqual([]);
  });
});
