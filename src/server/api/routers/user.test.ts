import { describe, expect, it } from "vitest";

import { userPreferences } from "@/server/db/schema";
import {
  createTestCaller,
  db,
  testSession,
} from "../../../../tests/helpers/trpc";

describe("userRouter", () => {
  it("creates and returns system preferences on the first read", async () => {
    await expect(createTestCaller().user.getPreferences()).resolves.toEqual({
      theme: "system",
    });
    await expect(db.query.userPreferences.findFirst()).resolves.toMatchObject({
      userId: testSession.user.id,
      theme: "system",
    });
  });

  it("returns existing preferences", async () => {
    await db.insert(userPreferences).values({
      userId: testSession.user.id,
      theme: "dark",
    });

    await expect(createTestCaller().user.getPreferences()).resolves.toEqual({
      theme: "dark",
    });
  });

  it("updates preferences with an upsert", async () => {
    await expect(
      createTestCaller().user.updatePreferences({ theme: "light" }),
    ).resolves.toEqual({ theme: "light" });
    await expect(db.query.userPreferences.findFirst()).resolves.toMatchObject({
      userId: testSession.user.id,
      theme: "light",
    });
  });

  it("rejects an empty preferences update", async () => {
    await expect(
      createTestCaller().user.updatePreferences({}),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(db.query.userPreferences.findFirst()).resolves.toBeUndefined();
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      createTestCaller(null).user.getPreferences(),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      createTestCaller(null).user.updatePreferences({ theme: "dark" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
