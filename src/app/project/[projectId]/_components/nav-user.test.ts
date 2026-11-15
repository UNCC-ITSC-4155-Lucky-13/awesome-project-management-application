import { describe, expect, it, vi } from "vitest";

import { getUserInitials, signOutAndRedirect } from "./nav-user";

const signOut = vi.hoisted(() => vi.fn());

vi.mock("@/server/better-auth/client", () => ({
  authClient: { signOut },
}));

describe("NavUser", () => {
  it("creates initials from the first two name parts", () => {
    expect(getUserInitials("Ada Lovelace")).toBe("AL");
    expect(getUserInitials("Grace")).toBe("G");
    expect(getUserInitials(null)).toBe("?");
  });

  it("signs out before redirecting", async () => {
    signOut.mockResolvedValue(undefined);
    const redirect = vi.fn();

    await signOutAndRedirect(redirect);

    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
  });

  it("does not redirect when sign out returns an error", async () => {
    signOut.mockResolvedValue({
      data: null,
      error: new Error("Unable to sign out"),
    });
    const redirect = vi.fn();

    await expect(signOutAndRedirect(redirect)).rejects.toThrow(
      "Unable to sign out",
    );

    expect(redirect).not.toHaveBeenCalled();
  });
});
