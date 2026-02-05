import { describe, it, expect, vi } from "vitest";

vi.mock("../git/git-helpers.js", () => ({
  exitWithMessage: (message: string): never => {
    throw new Error(message);
  },
}));

const { assertRemovalSafe } = await import("./assert-removal-safe.js");

describe("assertRemovalSafe", () => {
  it("throws when target equals main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo",
        mainPath: "/Users/acme/repo",
        registeredPath: undefined,
      });
    }).toThrowError("Refusing to remove the main worktree.");
  });

  it("throws when target contains the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme",
        mainPath: "/Users/acme/repo",
        registeredPath: undefined,
      });
    }).toThrowError(
      "Refusing to remove a directory containing the main worktree.",
    );
  });

  it("throws when unregistered target is inside the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo/.git",
        mainPath: "/Users/acme/repo",
        registeredPath: undefined,
      });
    }).toThrowError(
      "Refusing to remove an unregistered directory inside the main worktree.",
    );
  });

  it("allows registered worktrees inside the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo/feature",
        mainPath: "/Users/acme/repo",
        registeredPath: "/Users/acme/repo/feature",
      });
    }).not.toThrowError();
  });

  it("allows directories outside the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo-feature",
        mainPath: "/Users/acme/repo",
        registeredPath: undefined,
      });
    }).not.toThrowError();
  });
});
