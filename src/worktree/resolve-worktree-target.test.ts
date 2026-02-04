import { describe, it, expect } from "vitest";
import { resolveWorktreeTarget } from "./resolve-worktree-target.js";

describe("resolveWorktreeTarget", () => {
  it("resolves by branch name when available", () => {
    const result = resolveWorktreeTarget({
      input: "feature/foo",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [
        {
          path: "/Users/acme/repo-feature/foo",
          head: "2222222222222222222222222222222222222222",
          branch: "feature/foo",
          isDetached: false,
        },
      ],
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-feature/foo",
        head: "2222222222222222222222222222222222222222",
        branch: "feature/foo",
        isDetached: false,
      },
    });
  });

  it("resolves detached worktree by expected repo-branch path", () => {
    const result = resolveWorktreeTarget({
      input: "test-29",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [
        {
          path: "/Users/acme/repo-test-29",
          head: "3333333333333333333333333333333333333333",
          branch: undefined,
          isDetached: true,
        },
      ],
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-test-29",
        head: "3333333333333333333333333333333333333333",
        branch: undefined,
        isDetached: true,
      },
    });
  });

  it("resolves detached worktree by directory name in parent folder", () => {
    const result = resolveWorktreeTarget({
      input: "repo-test-29",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [
        {
          path: "/Users/acme/repo-test-29",
          head: "3333333333333333333333333333333333333333",
          branch: undefined,
          isDetached: true,
        },
      ],
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-test-29",
        head: "3333333333333333333333333333333333333333",
        branch: undefined,
        isDetached: true,
      },
    });
  });

  it("resolves detached worktree by absolute path", () => {
    const result = resolveWorktreeTarget({
      input: "/Users/acme/repo-test-29",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [
        {
          path: "/Users/acme/repo-test-29",
          head: "3333333333333333333333333333333333333333",
          branch: undefined,
          isDetached: true,
        },
      ],
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-test-29",
        head: "3333333333333333333333333333333333333333",
        branch: undefined,
        isDetached: true,
      },
    });
  });

  it("returns an ambiguous result for multiple basename matches", () => {
    const result = resolveWorktreeTarget({
      input: "repo-test-29",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [
        {
          path: "/tmp/repo-test-29",
          head: "4444444444444444444444444444444444444444",
          branch: undefined,
          isDetached: true,
        },
        {
          path: "/var/repo-test-29",
          head: "5555555555555555555555555555555555555555",
          branch: undefined,
          isDetached: true,
        },
      ],
    });

    expect(result).toEqual({
      kind: "ambiguous",
      message:
        "Multiple worktrees match 'repo-test-29'. Re-run with --interactive or pass a full path.",
    });
  });

  it("returns candidate paths for orphaned branch input", () => {
    const result = resolveWorktreeTarget({
      input: "feature/bar",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [],
    });

    expect(result).toEqual({
      kind: "candidates",
      candidatePaths: [
        "/Users/acme/repo-feature/bar",
        "/Users/acme/feature/bar",
      ],
      resolvedInputPath: "/Users/acme/repo/feature/bar",
      isPathInput: false,
      input: "feature/bar",
    });
  });

  it("returns a single resolved candidate path for path input", () => {
    const result = resolveWorktreeTarget({
      input: "../orphan",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [],
    });

    expect(result).toEqual({
      kind: "candidates",
      candidatePaths: ["/Users/acme/orphan"],
      resolvedInputPath: "/Users/acme/orphan",
      isPathInput: true,
      input: "../orphan",
    });
  });
});
