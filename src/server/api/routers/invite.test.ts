import { afterEach, describe, expect, it, vi } from "vitest";

import {
  account,
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
const secondProjectId = "00000000-0000-4000-8000-000000000002";
const now = new Date();

async function createProject(id = projectId, name = "Project") {
  await db.insert(projects).values({ id, name });
  await db.insert(projectMembers).values({
    projectId: id,
    userId: testSession.user.id,
    role: "owner",
  });
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

async function linkGithubAccount(userId: string, login: string) {
  await db.insert(account).values({
    id: `${userId}-account-id`,
    accountId: "583231",
    providerId: "github",
    userId,
    accessToken: `${userId}-github-token`,
    createdAt: now,
    updatedAt: now,
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return new Response(JSON.stringify({ login }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("inviteRouter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires authentication for every procedure", async () => {
    const caller = createTestCaller(null).invite;

    await expect(
      caller.send({ projectId, githubUsername: "octocat" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.listSelf()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.listProject({ projectId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller.respond({ projectId, action: "deny" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("only allows project members to send and list project invites", async () => {
    await expect(
      createTestCaller().invite.send({ projectId, githubUsername: "octocat" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await createProject();
    const invite = await createTestCaller().invite.send({
      projectId,
      githubUsername: "octocat",
    });
    expect(invite).toMatchObject({
      projectId,
      githubUsername: "octocat",
      createdBy: testSession.user.id,
    });

    await expect(
      callerFor("outsider", "Outsider").invite.listProject({ projectId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createTestCaller().invite.listProject({ projectId }),
    ).resolves.toMatchObject([{ githubUsername: "octocat", projectId }]);
  });

  it("renews an existing invite instead of creating a duplicate", async () => {
    await createProject();
    const first = await createTestCaller().invite.send({
      projectId,
      githubUsername: "octocat",
    });
    const second = await createTestCaller().invite.send({
      projectId,
      githubUsername: "octocat",
    });

    expect(second.id).toBe(first.id);
    expect(await db.query.projectInvites.findMany()).toHaveLength(1);
    expect(second.expiresAt.getTime()).toBeGreaterThan(
      first.expiresAt.getTime(),
    );
  });

  it("lists active invites for the user's GitHub username", async () => {
    await createProject(projectId, "Active Project");
    await createProject(secondProjectId, "Expired Project");
    await createUser("invitee", "Not the username");
    await linkGithubAccount("invitee", "octocat");
    await db.insert(projectInvites).values([
      {
        projectId,
        githubUsername: "octocat",
        createdBy: testSession.user.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        projectId: secondProjectId,
        githubUsername: "octocat",
        createdBy: testSession.user.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    ]);

    await expect(
      callerFor("invitee", "Not the username").invite.listSelf(),
    ).resolves.toMatchObject([
      {
        projectId,
        projectName: "Active Project",
        createdBy: testSession.user.id,
      },
    ]);
  });

  it("resolves the username from the linked GitHub profile", async () => {
    await createProject();
    await createUser("account-user", "Account User");
    await linkGithubAccount("account-user", "linked-octocat");
    await db.insert(projectInvites).values({
      projectId,
      githubUsername: "linked-octocat",
      createdBy: testSession.user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      callerFor("account-user", "Account User").invite.listSelf(),
    ).resolves.toHaveLength(1);

    await expect(
      callerFor("named-user", "Named User").invite.listSelf(),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("accepts an active invite and adds the user to the project", async () => {
    await createProject();
    await createUser("invitee", "Invitee");
    await linkGithubAccount("invitee", "accept-me");
    await db.insert(projectInvites).values({
      projectId,
      githubUsername: "accept-me",
      createdBy: testSession.user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      callerFor("invitee", "Invitee").invite.respond({
        projectId,
        action: "accept",
      }),
    ).resolves.toEqual({ success: true });
    expect(
      await db.query.projectMembers.findFirst({
        where: (members, { eq }) => eq(members.userId, "invitee"),
      }),
    ).toMatchObject({ projectId, userId: "invitee", role: "member" });
    expect(await db.query.projectInvites.findMany()).toEqual([]);
  });

  it("denies an active invite without adding membership", async () => {
    await createProject();
    await createUser("invitee", "deny-me");
    await linkGithubAccount("invitee", "deny-me");
    await db.insert(projectInvites).values({
      projectId,
      githubUsername: "deny-me",
      createdBy: testSession.user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      callerFor("invitee", "deny-me").invite.respond({
        projectId,
        action: "deny",
      }),
    ).resolves.toEqual({ success: true });
    expect(await db.query.projectMembers.findMany()).toEqual([
      expect.objectContaining({ userId: testSession.user.id }),
    ]);
    expect(await db.query.projectInvites.findMany()).toEqual([]);
  });

  it("filters expired invites and rejects expired responses", async () => {
    await createProject();
    await createUser("expired-user", "Expired User");
    await linkGithubAccount("expired-user", "expired-user");
    await db.insert(projectInvites).values({
      projectId,
      githubUsername: "expired-user",
      createdBy: testSession.user.id,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      callerFor("expired-user", "Expired User").invite.listSelf(),
    ).resolves.toEqual([]);
    await expect(
      callerFor("expired-user", "Expired User").invite.respond({
        projectId,
        action: "accept",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when no invite matches the user and project", async () => {
    await createUser("missing", "Missing User");
    await linkGithubAccount("missing", "missing");
    await expect(
      callerFor("missing", "Missing User").invite.respond({
        projectId,
        action: "deny",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
