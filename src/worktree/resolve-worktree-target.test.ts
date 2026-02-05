import os from "node:os";
import { describe, it, expect, vi } from "vitest";
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
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-feature/foo",
        head: "2222222222222222222222222222222222222222",
        branch: "feature/foo",
        isDetached: false,
      },
      isPathInput: false,
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
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-test-29",
        head: "3333333333333333333333333333333333333333",
        branch: undefined,
        isDetached: true,
      },
      isPathInput: false,
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
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-test-29",
        head: "3333333333333333333333333333333333333333",
        branch: undefined,
        isDetached: true,
      },
      isPathInput: false,
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
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: "/Users/acme/repo-test-29",
        head: "3333333333333333333333333333333333333333",
        branch: undefined,
        isDetached: true,
      },
      isPathInput: true,
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
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "ambiguous",
      message:
        "Multiple worktrees match 'repo-test-29'. Re-run with --interactive or pass a full path.",
    });
  });

  it("matches basenames case-insensitively on win32", () => {
    const result = resolveWorktreeTarget({
      input: "repo-test-29",
      cwd: String.raw`C:\Users\acme\repo`,
      mainPath: String.raw`C:\Users\acme\repo`,
      worktrees: [
        {
          path: String.raw`D:\tmp\Repo-Test-29`,
          head: "4444444444444444444444444444444444444444",
          branch: undefined,
          isDetached: true,
        },
      ],
      platform: "win32",
    });

    expect(result).toEqual({
      kind: "registered",
      worktree: {
        path: String.raw`D:\tmp\Repo-Test-29`,
        head: "4444444444444444444444444444444444444444",
        branch: undefined,
        isDetached: true,
      },
      isPathInput: false,
    });
  });

  it("returns candidate paths for orphaned branch input", () => {
    const result = resolveWorktreeTarget({
      input: "feature/bar",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [],
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "candidates",
      candidatePaths: ["/Users/acme/repo-feature/bar"],
      resolvedInputPath: "/Users/acme/repo/feature/bar",
      isPathInput: false,
      input: "feature/bar",
    });
  });

  it("rejects branch-like input containing '..' path segments", () => {
    const result = resolveWorktreeTarget({
      input: "feature/../oops",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [],
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "ambiguous",
      message:
        "Input 'feature/../oops' contains '..' path segments. Pass a full path or use --interactive.",
    });
  });

  it("returns candidate paths for orphaned directory name input", () => {
    const result = resolveWorktreeTarget({
      input: "orphan",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [],
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "candidates",
      candidatePaths: ["/Users/acme/repo-orphan", "/Users/acme/orphan"],
      resolvedInputPath: "/Users/acme/repo/orphan",
      isPathInput: false,
      input: "orphan",
    });
  });

  it("returns a single resolved candidate path for path input", () => {
    const result = resolveWorktreeTarget({
      input: "../orphan",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [],
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "candidates",
      candidatePaths: ["/Users/acme/orphan"],
      resolvedInputPath: "/Users/acme/orphan",
      isPathInput: true,
      input: "../orphan",
    });
  });

  it("expands quoted tilde paths", () => {
    const homedirSpy = vi.spyOn(os, "homedir").mockReturnValue("/Users/acme");

    const result = resolveWorktreeTarget({
      input: "~/repo-test-29",
      cwd: "/Users/acme/repo",
      mainPath: "/Users/acme/repo",
      worktrees: [],
      platform: "linux",
    });

    expect(result).toEqual({
      kind: "candidates",
      candidatePaths: ["/Users/acme/repo-test-29"],
      resolvedInputPath: "/Users/acme/repo-test-29",
      isPathInput: true,
      input: "~/repo-test-29",
    });

    homedirSpy.mockRestore();
  });
});
