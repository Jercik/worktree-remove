import { describe, it, expect } from "vitest";
import { assertRemovalSafe } from "./assert-removal-safe.js";

describe("assertRemovalSafe", () => {
  it("throws when target equals main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo",
        mainPath: "/Users/acme/repo",
        registeredWorktree: undefined,
      });
    }).toThrow("Refusing to remove the main worktree.");
  });

  it("throws when target contains the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme",
        mainPath: "/Users/acme/repo",
        registeredWorktree: undefined,
      });
    }).toThrow("Refusing to remove a directory containing the main worktree.");
  });

  it("throws when unregistered target is inside the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo/.git",
        mainPath: "/Users/acme/repo",
        registeredWorktree: undefined,
      });
    }).toThrow("Refusing to remove an unregistered directory inside the main worktree.");
  });

  it("allows registered worktrees inside the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo/feature",
        mainPath: "/Users/acme/repo",
        registeredWorktree: {
          path: "/Users/acme/repo/feature",
          head: "2222222222222222222222222222222222222222",
          branch: "feature",
          isDetached: false,
          lock: undefined,
        },
      });
    }).not.toThrow();
  });

  it("allows directories outside the main worktree", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo-feature",
        mainPath: "/Users/acme/repo",
        registeredWorktree: undefined,
      });
    }).not.toThrow();
  });

  it("throws when the registered worktree is locked, naming its lock reason", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo-feature",
        mainPath: "/Users/acme/repo",
        registeredWorktree: {
          path: "/Users/acme/repo-feature",
          head: "2222222222222222222222222222222222222222",
          branch: "feature",
          isDetached: false,
          lock: { reason: "on external drive" },
        },
      });
    }).toThrow(
      "Refusing to remove locked worktree '/Users/acme/repo-feature' (reason: on external drive). Unlock it with 'git worktree unlock' first.",
    );
  });

  it("throws when the registered worktree is locked without a reason", () => {
    expect(() => {
      assertRemovalSafe({
        targetPath: "/Users/acme/repo-feature",
        mainPath: "/Users/acme/repo",
        registeredWorktree: {
          path: "/Users/acme/repo-feature",
          head: "2222222222222222222222222222222222222222",
          branch: "feature",
          isDetached: false,
          lock: { reason: undefined },
        },
      });
    }).toThrow(
      "Refusing to remove locked worktree '/Users/acme/repo-feature'. Unlock it with 'git worktree unlock' first.",
    );
  });
});
