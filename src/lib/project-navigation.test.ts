import { describe, expect, it } from "vitest";

import { projectHref, recoveryPath } from "./project-navigation";

describe("projectHref", () => {
  it("opens the project's default view", () => {
    expect(projectHref("abc")).toBe("/project/abc");
  });

  it("encodes the project ID", () => {
    expect(projectHref("a/b?c")).toBe("/project/a%2Fb%3Fc");
  });
});

describe("recoveryPath", () => {
  it("sends users with no projects to onboarding", () => {
    expect(recoveryPath([])).toBe("/projects/create");
  });

  it("sends users with projects to project selection", () => {
    expect(recoveryPath([{ id: "one" }])).toBe("/projects");
  });
});
