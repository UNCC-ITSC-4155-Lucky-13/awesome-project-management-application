import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { projectMembers, projects, user } from "@/server/db/schema";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

const projectId = "00000000-0000-4000-8000-000000000001";
const secondProjectId = "00000000-0000-4000-8000-000000000002";
const now = new Date();
const lastManagerMessage =
  "A project needs at least one owner or admin. Appoint another owner or admin first.";

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

async function findMembership(project: string, userId: string) {
  return db.query.projectMembers.findFirst({
    where: (members, { and, eq }) =>
      and(eq(members.projectId, project), eq(members.userId, userId)),
  });
}

async function setRole(userId: string, role: Role) {
  await db
    .update(projectMembers)
    .set({ role })
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    );
}

async function managerIds() {
  const managers = await db.query.projectMembers.findMany({
    where: (members, { and, inArray }) =>
      and(
        eq(members.projectId, projectId),
        inArray(members.role, ["owner", "admin"]),
      ),
  });
  return managers.map((manager) => manager.userId);
}

describe("memberRouter", () => {
  // The shared test helper already creates "test-user" before every test.
  // Project 1: test-user (owner), admin-user (admin), member-user (member).
  // outsider has an account but belongs to no project.
  beforeEach(async () => {
    await createProject(projectId, "Project");
    await createUser("admin-user", "Admin User");
    await createUser("member-user", "Member User");
    await createUser("outsider", "Outsider");
    await addMember(projectId, testSession.user.id, "owner");
    await addMember(projectId, "admin-user", "admin");
    await addMember(projectId, "member-user", "member");
  });

  it("requires authentication for every procedure", async () => {
    const caller = createTestCaller(null).member;

    await expect(caller.list({ projectId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller.updateRole({ projectId, userId: "member-user", role: "admin" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.remove({ projectId, userId: "member-user" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects malformed input", async () => {
    const caller = createTestCaller().member;

    await expect(
      caller.list({ projectId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.updateRole({
        projectId,
        userId: "member-user",
        role: "superuser" as Role,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.remove({ projectId: "not-a-uuid", userId: "member-user" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  describe("list", () => {
    it("lets any member list the project's members with public fields only", async () => {
      const members = await callerFor("member-user", "Member User").member.list(
        {
          projectId,
        },
      );

      // arrayContaining compares each object exactly, so an email (or any
      // other private column) in the result would fail this assertion.
      expect(members).toHaveLength(3);
      expect(members).toEqual(
        expect.arrayContaining([
          {
            userId: testSession.user.id,
            name: testSession.user.name,
            image: null,
            role: "owner",
          },
          {
            userId: "admin-user",
            name: "Admin User",
            image: null,
            role: "admin",
          },
          {
            userId: "member-user",
            name: "Member User",
            image: null,
            role: "member",
          },
        ]),
      );
    });

    it("rejects callers who are not members of the project", async () => {
      await expect(
        callerFor("outsider", "Outsider").member.list({ projectId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("only returns members of the requested project", async () => {
      await createProject(secondProjectId, "Second Project");
      await createUser("other-user", "Other User");
      await addMember(secondProjectId, testSession.user.id, "owner");
      await addMember(secondProjectId, "other-user", "member");

      const members = await createTestCaller().member.list({
        projectId: secondProjectId,
      });

      expect(members.map((member) => member.userId).sort()).toEqual(
        [testSession.user.id, "other-user"].sort(),
      );
    });
  });

  describe("updateRole", () => {
    it("lets an owner change a member's role", async () => {
      await expect(
        createTestCaller().member.updateRole({
          projectId,
          userId: "member-user",
          role: "admin",
        }),
      ).resolves.toMatchObject({
        projectId,
        userId: "member-user",
        role: "admin",
      });
      expect(await findMembership(projectId, "member-user")).toMatchObject({
        role: "admin",
      });
    });

    it("lets an admin change a member's role", async () => {
      await callerFor("admin-user", "Admin User").member.updateRole({
        projectId,
        userId: "member-user",
        role: "owner",
      });

      expect(await findMembership(projectId, "member-user")).toMatchObject({
        role: "owner",
      });
    });

    it("rejects ordinary members and non-members without changing anything", async () => {
      await expect(
        callerFor("member-user", "Member User").member.updateRole({
          projectId,
          userId: "member-user",
          role: "owner",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        callerFor("outsider", "Outsider").member.updateRole({
          projectId,
          userId: "member-user",
          role: "owner",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(await findMembership(projectId, "member-user")).toMatchObject({
        role: "member",
      });
    });

    it("rejects a target who is not in the project", async () => {
      await expect(
        createTestCaller().member.updateRole({
          projectId,
          userId: "outsider",
          role: "admin",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await findMembership(projectId, "outsider")).toBeUndefined();
    });

    it("does not touch a user's membership in another project", async () => {
      await createProject(secondProjectId, "Second Project");
      await createUser("other-user", "Other User");
      await addMember(secondProjectId, "other-user", "member");

      await expect(
        createTestCaller().member.updateRole({
          projectId,
          userId: "other-user",
          role: "owner",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await findMembership(secondProjectId, "other-user")).toMatchObject(
        { role: "member" },
      );
    });

    it("does not let a manager of one project act on another", async () => {
      await createProject(secondProjectId, "Second Project");
      await createUser("other-user", "Other User");
      await addMember(secondProjectId, "other-user", "member");

      await expect(
        createTestCaller().member.updateRole({
          projectId: secondProjectId,
          userId: "other-user",
          role: "owner",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await findMembership(secondProjectId, "other-user")).toMatchObject(
        { role: "member" },
      );
    });

    describe("last owner or admin", () => {
      it("rejects demoting the last owner", async () => {
        await setRole("admin-user", "member");

        await expect(
          createTestCaller().member.updateRole({
            projectId,
            userId: testSession.user.id,
            role: "member",
          }),
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: lastManagerMessage,
        });
        expect(
          await findMembership(projectId, testSession.user.id),
        ).toMatchObject({ role: "owner" });
      });

      it("rejects demoting the last admin", async () => {
        await setRole(testSession.user.id, "member");

        await expect(
          callerFor("admin-user", "Admin User").member.updateRole({
            projectId,
            userId: "admin-user",
            role: "member",
          }),
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: lastManagerMessage,
        });
        expect(await findMembership(projectId, "admin-user")).toMatchObject({
          role: "admin",
        });
        expect(await db.query.projectMembers.findMany()).toHaveLength(3);
      });

      it("allows demoting an owner or admin when another remains", async () => {
        await createTestCaller().member.updateRole({
          projectId,
          userId: "admin-user",
          role: "member",
        });
        expect(await findMembership(projectId, "admin-user")).toMatchObject({
          role: "member",
        });

        await setRole("admin-user", "admin");
        await createTestCaller().member.updateRole({
          projectId,
          userId: testSession.user.id,
          role: "member",
        });
        expect(
          await findMembership(projectId, testSession.user.id),
        ).toMatchObject({ role: "member" });
      });

      it("allows changing the last manager's role to another manager role", async () => {
        await setRole("admin-user", "member");

        await createTestCaller().member.updateRole({
          projectId,
          userId: testSession.user.id,
          role: "admin",
        });

        expect(
          await findMembership(projectId, testSession.user.id),
        ).toMatchObject({ role: "admin" });
      });

      it("lets only one of two managers demote the other at the same time", async () => {
        const results = await Promise.allSettled([
          createTestCaller().member.updateRole({
            projectId,
            userId: "admin-user",
            role: "member",
          }),
          callerFor("admin-user", "Admin User").member.updateRole({
            projectId,
            userId: testSession.user.id,
            role: "member",
          }),
        ]);

        expect(results.map((result) => result.status).sort()).toEqual([
          "fulfilled",
          "rejected",
        ]);
        expect(await managerIds()).toHaveLength(1);
      });
    });
  });

  describe("remove", () => {
    it("lets an owner remove a member without deleting their account", async () => {
      await expect(
        createTestCaller().member.remove({ projectId, userId: "member-user" }),
      ).resolves.toEqual({ success: true });

      expect(await findMembership(projectId, "member-user")).toBeUndefined();
      expect(
        await db.query.user.findFirst({
          where: (users, { eq }) => eq(users.id, "member-user"),
        }),
      ).toMatchObject({ id: "member-user" });
    });

    it("lets an admin remove a member", async () => {
      await callerFor("admin-user", "Admin User").member.remove({
        projectId,
        userId: "member-user",
      });

      expect(await findMembership(projectId, "member-user")).toBeUndefined();
    });

    it("makes the removed user lose project access", async () => {
      await createTestCaller().member.remove({
        projectId,
        userId: "member-user",
      });

      await expect(
        callerFor("member-user", "Member User").member.list({ projectId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("keeps the user's memberships in other projects", async () => {
      await createProject(secondProjectId, "Second Project");
      await addMember(secondProjectId, "member-user", "member");

      await createTestCaller().member.remove({
        projectId,
        userId: "member-user",
      });

      expect(await findMembership(projectId, "member-user")).toBeUndefined();
      expect(
        await findMembership(secondProjectId, "member-user"),
      ).toMatchObject({ role: "member" });
    });

    it("rejects ordinary members and non-members without removing anyone", async () => {
      await expect(
        callerFor("member-user", "Member User").member.remove({
          projectId,
          userId: "admin-user",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        callerFor("outsider", "Outsider").member.remove({
          projectId,
          userId: "member-user",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(await db.query.projectMembers.findMany()).toHaveLength(3);
    });

    it("rejects a target who is not in the project", async () => {
      await createProject(secondProjectId, "Second Project");
      await createUser("other-user", "Other User");
      await addMember(secondProjectId, "other-user", "member");

      await expect(
        createTestCaller().member.remove({ projectId, userId: "outsider" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        createTestCaller().member.remove({ projectId, userId: "other-user" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(await findMembership(secondProjectId, "other-user")).toMatchObject(
        { role: "member" },
      );
    });

    describe("last owner or admin", () => {
      it("rejects removing the last owner", async () => {
        await setRole("admin-user", "member");

        await expect(
          createTestCaller().member.remove({
            projectId,
            userId: testSession.user.id,
          }),
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: lastManagerMessage,
        });
        expect(await db.query.projectMembers.findMany()).toHaveLength(3);
      });

      it("rejects removing the last admin", async () => {
        await setRole(testSession.user.id, "member");

        await expect(
          callerFor("admin-user", "Admin User").member.remove({
            projectId,
            userId: "admin-user",
          }),
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: lastManagerMessage,
        });
        expect(await db.query.projectMembers.findMany()).toHaveLength(3);
      });

      it("allows removing an owner or admin when another remains", async () => {
        await createTestCaller().member.remove({
          projectId,
          userId: "admin-user",
        });
        expect(await findMembership(projectId, "admin-user")).toBeUndefined();

        await addMember(projectId, "outsider", "admin");
        await createTestCaller().member.remove({
          projectId,
          userId: testSession.user.id,
        });
        expect(
          await findMembership(projectId, testSession.user.id),
        ).toBeUndefined();
      });

      it("allows removing a member when only one manager remains", async () => {
        await setRole("admin-user", "member");

        await createTestCaller().member.remove({
          projectId,
          userId: "member-user",
        });

        expect(await findMembership(projectId, "member-user")).toBeUndefined();
        expect(await managerIds()).toEqual([testSession.user.id]);
      });

      it("lets only one of two managers remove the other at the same time", async () => {
        const results = await Promise.allSettled([
          createTestCaller().member.remove({
            projectId,
            userId: "admin-user",
          }),
          callerFor("admin-user", "Admin User").member.remove({
            projectId,
            userId: testSession.user.id,
          }),
        ]);

        expect(results.map((result) => result.status).sort()).toEqual([
          "fulfilled",
          "rejected",
        ]);
        expect(await managerIds()).toHaveLength(1);
      });
    });
  });
});
