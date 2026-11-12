import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  comments,
  projectMembers,
  projects,
  stories,
  user,
} from "@/server/db/schema";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

const missingId = "00000000-0000-4000-8000-000000000001";
const now = new Date();

type Role = "owner" | "admin" | "member";

let projectId: string;
let storyId: string;

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

async function addMember(userId: string, role: Role) {
  await db.insert(projectMembers).values({ projectId, userId, role });
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

async function addComment(
  story: string,
  createdBy: string,
  content: string,
  createdAt = new Date(),
) {
  const [row] = await db
    .insert(comments)
    .values({ storyId: story, createdBy, content, createdAt })
    .returning();
  return row!;
}

async function findComment(id: string) {
  return db.query.comments.findFirst({ where: eq(comments.id, id) });
}

describe("commentRouter", () => {
  // The shared test helper already creates "test-user" before every test.
  // One project: test-user (owner), admin-user (admin), member-user (member).
  // outsider has an account but belongs to no project. One story in it.
  beforeEach(async () => {
    const [project] = await db
      .insert(projects)
      .values({ name: "Project" })
      .returning();
    projectId = project!.id;

    await createUser("admin-user", "Admin User");
    await createUser("member-user", "Member User");
    await createUser("outsider", "Outsider");
    await addMember(testSession.user.id, "owner");
    await addMember("admin-user", "admin");
    await addMember("member-user", "member");

    const [story] = await db
      .insert(stories)
      .values({
        projectId,
        creatorId: testSession.user.id,
        name: "Story",
      })
      .returning();
    storyId = story!.id;
  });

  it("requires authentication for every procedure", async () => {
    const caller = createTestCaller(null).comment;

    await expect(
      caller.create({ storyId, content: "Hi" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.edit({ id: missingId, content: "Hi" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.delete({ id: missingId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.list({ storyId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects malformed input", async () => {
    const caller = createTestCaller().comment;
    const existing = await addComment(storyId, testSession.user.id, "Keep");

    await expect(
      caller.create({ storyId, content: "   " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.create({ storyId: "not-a-uuid", content: "Hi" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.edit({ id: existing.id, content: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.delete({ id: "not-a-uuid" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.list({ storyId: "not-a-uuid" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect((await findComment(existing.id))?.content).toBe("Keep");
  });

  describe("create", () => {
    it("lets a member comment, trims content, and starts unedited", async () => {
      const created = await callerFor(
        "member-user",
        "Member User",
      ).comment.create({ storyId, content: "  Looks good  " });

      expect(created).toMatchObject({
        storyId,
        content: "Looks good",
        editedAt: null,
        author: { id: "member-user", name: "Member User", image: null },
      });
      expect(await findComment(created.id)).toMatchObject({
        createdBy: "member-user",
        content: "Looks good",
        editedAt: null,
      });
    });

    it("rejects non-members without creating anything", async () => {
      await expect(
        callerFor("outsider", "Outsider").comment.create({
          storyId,
          content: "Hi",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(await db.query.comments.findMany()).toHaveLength(0);
    });

    it("rejects a story that does not exist", async () => {
      await expect(
        createTestCaller().comment.create({
          storyId: missingId,
          content: "Hi",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("list", () => {
    it("returns the story's comments oldest first with author details", async () => {
      await addComment(
        storyId,
        "member-user",
        "third",
        new Date("2026-01-03T00:00:00Z"),
      );
      await addComment(
        storyId,
        "admin-user",
        "first",
        new Date("2026-01-01T00:00:00Z"),
      );
      await addComment(
        storyId,
        testSession.user.id,
        "second",
        new Date("2026-01-02T00:00:00Z"),
      );

      const listed = await callerFor("member-user", "Member User").comment.list(
        {
          storyId,
        },
      );

      expect(listed.map((comment) => comment.content)).toEqual([
        "first",
        "second",
        "third",
      ]);
      // Exact comparison: an email or any other private column would fail.
      expect(listed[0]!.author).toEqual({
        id: "admin-user",
        name: "Admin User",
        image: null,
      });
    });

    it("only returns comments for the requested story", async () => {
      const [otherStory] = await db
        .insert(stories)
        .values({
          projectId,
          creatorId: testSession.user.id,
          name: "Other story",
        })
        .returning();
      await addComment(storyId, testSession.user.id, "on this story");
      await addComment(otherStory!.id, testSession.user.id, "on another story");

      const listed = await createTestCaller().comment.list({ storyId });

      expect(listed.map((comment) => comment.content)).toEqual([
        "on this story",
      ]);
    });

    it("rejects non-members", async () => {
      await addComment(storyId, testSession.user.id, "private");

      await expect(
        callerFor("outsider", "Outsider").comment.list({ storyId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a story that does not exist", async () => {
      await expect(
        createTestCaller().comment.list({ storyId: missingId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("edit", () => {
    it("lets the author edit and records editedAt", async () => {
      const comment = await addComment(storyId, "member-user", "Original");
      const before = new Date();

      const updated = await callerFor(
        "member-user",
        "Member User",
      ).comment.edit({ id: comment.id, content: "  Updated  " });

      expect(updated).toMatchObject({
        id: comment.id,
        createdBy: "member-user",
        content: "Updated",
      });
      expect(updated.editedAt).toBeInstanceOf(Date);
      expect(updated.editedAt?.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect((await findComment(comment.id))?.content).toBe("Updated");
    });

    it("rejects everyone but the author, admins and owners included", async () => {
      const comment = await addComment(storyId, "member-user", "Original");

      await expect(
        callerFor("admin-user", "Admin User").comment.edit({
          id: comment.id,
          content: "Changed",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        createTestCaller().comment.edit({
          id: comment.id,
          content: "Changed",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        callerFor("outsider", "Outsider").comment.edit({
          id: comment.id,
          content: "Changed",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(await findComment(comment.id)).toMatchObject({
        content: "Original",
        editedAt: null,
      });
    });

    it("rejects a comment that does not exist", async () => {
      await expect(
        createTestCaller().comment.edit({ id: missingId, content: "Hi" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("delete", () => {
    it("lets the author delete their own comment", async () => {
      const comment = await addComment(storyId, "member-user", "Mine");

      await expect(
        callerFor("member-user", "Member User").comment.delete({
          id: comment.id,
        }),
      ).resolves.toEqual({ success: true });

      expect(await findComment(comment.id)).toBeUndefined();
    });

    it("lets an admin delete someone else's comment", async () => {
      const comment = await addComment(storyId, "member-user", "Theirs");

      await callerFor("admin-user", "Admin User").comment.delete({
        id: comment.id,
      });

      expect(await findComment(comment.id)).toBeUndefined();
    });

    it("lets an owner delete someone else's comment", async () => {
      const comment = await addComment(storyId, "member-user", "Theirs");

      await createTestCaller().comment.delete({ id: comment.id });

      expect(await findComment(comment.id)).toBeUndefined();
    });

    it("lets an author who is no longer in the project delete their comment", async () => {
      const comment = await addComment(storyId, "outsider", "Left behind");

      await callerFor("outsider", "Outsider").comment.delete({
        id: comment.id,
      });

      expect(await findComment(comment.id)).toBeUndefined();
    });

    it("rejects ordinary members and non-members deleting others' comments", async () => {
      const comment = await addComment(storyId, "admin-user", "Admin's");

      await expect(
        callerFor("member-user", "Member User").comment.delete({
          id: comment.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        callerFor("outsider", "Outsider").comment.delete({ id: comment.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(await findComment(comment.id)).toBeDefined();
    });

    it("rejects a comment that does not exist", async () => {
      await expect(
        createTestCaller().comment.delete({ id: missingId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("cascade deletes", () => {
    it("removes a story's comments when the story is deleted", async () => {
      await addComment(storyId, "member-user", "Gone with the story");

      await db.delete(stories).where(eq(stories.id, storyId));

      expect(await db.query.comments.findMany()).toHaveLength(0);
    });

    it("removes a user's comments when the user is deleted", async () => {
      await addComment(storyId, "member-user", "Gone with the user");
      await addComment(storyId, "admin-user", "Stays");

      await db.delete(user).where(eq(user.id, "member-user"));

      expect(
        (await db.query.comments.findMany()).map((comment) => comment.content),
      ).toEqual(["Stays"]);
    });
  });
});
