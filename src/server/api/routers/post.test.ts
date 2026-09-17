import { describe, expect, it } from "vitest";

import { posts } from "@/server/db/schema";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

describe("postRouter", () => {
  it("greets an unauthenticated caller", async () => {
    await expect(
      createTestCaller(null).post.hello({ text: "World" }),
    ).resolves.toEqual({ greeting: "Hello World" });
  });

  it.each(["create", "getLatest", "getSecretMessage"] as const)(
    "rejects unauthenticated %s calls",
    async (procedure) => {
      const caller = createTestCaller(null).post;
      const result =
        procedure === "create"
          ? caller.create({ name: "Post" })
          : caller[procedure]();
      await expect(result).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(await db.query.posts.findMany()).toEqual([]);
    },
  );

  it("creates a post owned by the authenticated user", async () => {
    await createTestCaller().post.create({ name: "New post" });
    expect(await db.query.posts.findMany()).toEqual([
      expect.objectContaining({
        name: "New post",
        createdById: testSession.user.id,
      }),
    ]);
  });

  it("rejects empty post names without writing to the database", async () => {
    await expect(
      createTestCaller().post.create({ name: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await db.query.posts.findMany()).toEqual([]);
  });

  it("returns the newest post by creation date, regardless of insertion order", async () => {
    await db.insert(posts).values([
      {
        name: "Newest",
        createdById: testSession.user.id,
        createdAt: new Date("2026-02-01"),
      },
      {
        name: "Older",
        createdById: testSession.user.id,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    await expect(createTestCaller().post.getLatest()).resolves.toMatchObject({
      name: "Newest",
    });
  });

  it("returns null when no posts exist", async () => {
    await expect(createTestCaller().post.getLatest()).resolves.toBeNull();
  });

  it("propagates a foreign-key violation without saving the post", async () => {
    const caller = createTestCaller({
      ...testSession,
      user: { ...testSession.user, id: "nonexistent-user" },
    });
    await expect(caller.post.create({ name: "Post" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(await db.query.posts.findMany()).toEqual([]);
  });

  it("returns the secret message to an authenticated caller", async () => {
    await expect(createTestCaller().post.getSecretMessage()).resolves.toBe(
      "you can now see this secret message!",
    );
  });
});
