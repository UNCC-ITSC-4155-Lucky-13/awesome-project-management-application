import { describe, expect, it } from "vitest";

import { parseGithubUsername } from "./github-username";

describe("parseGithubUsername", () => {
  it("trims and lowercases the username", () => {
    expect(parseGithubUsername("  OctoCat  ")).toEqual({ value: "octocat" });
  });

  it("accepts a pasted @username", () => {
    expect(parseGithubUsername("@octocat")).toEqual({ value: "octocat" });
  });

  it.each(["", "   ", "@", " @ "])("rejects empty input %j", (input) => {
    expect(parseGithubUsername(input)).toEqual({
      error: "Enter a GitHub username.",
    });
  });

  it("rejects usernames with spaces", () => {
    expect(parseGithubUsername("octo cat")).toEqual({
      error: "GitHub usernames can't contain spaces.",
    });
  });

  it("accepts 255 characters and rejects 256", () => {
    expect(parseGithubUsername("a".repeat(255))).toEqual({
      value: "a".repeat(255),
    });
    expect(parseGithubUsername("a".repeat(256))).toHaveProperty("error");
  });
});
