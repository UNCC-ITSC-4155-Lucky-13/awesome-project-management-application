import { describe, expect, it } from "vitest";

import {
  BLANK_COMMENT_MESSAGE,
  canDeleteComment,
  canEditComment,
  commentWriteErrorMessage,
  getAuthorInitials,
  isMembershipError,
  normalizeCommentContent,
} from "./comments";

const comment = { author: { id: "author" } };

describe("normalizeCommentContent", () => {
  it("trims surrounding whitespace and keeps inner newlines", () => {
    expect(normalizeCommentContent("  hello\n\nworld \n")).toBe(
      "hello\n\nworld",
    );
  });

  it("reduces whitespace-only input to an empty string", () => {
    expect(normalizeCommentContent(" \n\t ")).toBe("");
  });
});

describe("canEditComment", () => {
  it("allows only the author", () => {
    expect(canEditComment(comment, "author")).toBe(true);
    expect(canEditComment(comment, "someone-else")).toBe(false);
  });

  it("denies when there is no signed-in user", () => {
    expect(canEditComment(comment, undefined)).toBe(false);
    expect(canEditComment(comment, null)).toBe(false);
  });
});

describe("canDeleteComment", () => {
  it("allows the author regardless of role", () => {
    expect(canDeleteComment(comment, "author", "member")).toBe(true);
    expect(canDeleteComment(comment, "author", undefined)).toBe(true);
  });

  it("allows owners and admins to delete other people's comments", () => {
    expect(canDeleteComment(comment, "other", "owner")).toBe(true);
    expect(canDeleteComment(comment, "other", "admin")).toBe(true);
  });

  it("denies ordinary members and unknown roles", () => {
    expect(canDeleteComment(comment, "other", "member")).toBe(false);
    expect(canDeleteComment(comment, "other", undefined)).toBe(false);
  });

  it("denies when there is no signed-in user", () => {
    expect(canDeleteComment(comment, undefined, "owner")).toBe(false);
  });
});

describe("error helpers", () => {
  it("detects lost membership from the FORBIDDEN code", () => {
    expect(isMembershipError({ data: { code: "FORBIDDEN" } })).toBe(true);
    expect(isMembershipError({ data: { code: "NOT_FOUND" } })).toBe(false);
    expect(isMembershipError(null)).toBe(false);
  });

  it("explains failures and says text was kept for post and save", () => {
    expect(commentWriteErrorMessage("post", null)).toContain("still here");
    expect(commentWriteErrorMessage("save", undefined)).toContain("still here");
    expect(commentWriteErrorMessage("delete", null)).not.toContain(
      "still here",
    );
  });

  it("maps server codes to specific messages", () => {
    expect(
      commentWriteErrorMessage("delete", { data: { code: "FORBIDDEN" } }),
    ).toContain("permission");
    expect(
      commentWriteErrorMessage("save", { data: { code: "NOT_FOUND" } }),
    ).toContain("no longer exists");
    expect(
      commentWriteErrorMessage("post", { data: { code: "BAD_REQUEST" } }),
    ).toBe(BLANK_COMMENT_MESSAGE);
  });
});

describe("getAuthorInitials", () => {
  it("uses the first letters of up to two words", () => {
    expect(getAuthorInitials("ada lovelace byron")).toBe("AL");
    expect(getAuthorInitials("Grace")).toBe("G");
  });

  it("falls back to a placeholder", () => {
    expect(getAuthorInitials("  ")).toBe("?");
    expect(getAuthorInitials(null)).toBe("?");
  });
});
