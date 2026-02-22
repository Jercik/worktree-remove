import { describe, it, expect } from "vitest";
import { getRemovalDisplayInfo } from "./get-removal-display.js";

type WorktreeEntry = {
  path: string;
  head: string | undefined;
  branch: string | undefined;
  isDetached: boolean;
};

const worktreeWithBranch: WorktreeEntry = {
  path: "/Users/acme/repo-feature",
  head: "abc1234def5678",
  branch: "feature",
  isDetached: false,
};

const worktreeDetached: WorktreeEntry = {
  path: "/Users/acme/repo-detached",
  head: "deadbeef1234567",
  branch: undefined,
  isDetached: true,
};

const worktreeDetachedNoHead: WorktreeEntry = {
  path: "/Users/acme/repo-detached",
  head: undefined,
  branch: undefined,
  isDetached: true,
};

describe("getRemovalDisplayInfo", () => {
  it("returns registered status when registeredPath is set", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-feature",
      registeredPath: "/Users/acme/repo-feature",
      registeredWorktree: worktreeWithBranch,
      isPathInputTarget: false,
    });

    expect(result.status).toBe("registered worktree");
  });

  it("returns unregistered status for path input without registration", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/some-dir",
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: true,
    });

    expect(result.status).toBe("unregistered directory");
  });

  it("returns orphaned status for non-path input without registration", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-old",
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: false,
    });

    expect(result.status).toBe("orphaned directory");
  });

  it("returns branch name as referenceInfo for branch worktree", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-feature",
      registeredPath: "/Users/acme/repo-feature",
      registeredWorktree: worktreeWithBranch,
      isPathInputTarget: false,
    });

    expect(result.referenceInfo).toBe("branch feature");
  });

  it("returns detached HEAD with short SHA as referenceInfo", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-detached",
      registeredPath: "/Users/acme/repo-detached",
      registeredWorktree: worktreeDetached,
      isPathInputTarget: false,
    });

    expect(result.referenceInfo).toBe("detached HEAD @ deadbee");
  });

  it("returns detached HEAD without SHA when head is missing", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-detached",
      registeredPath: "/Users/acme/repo-detached",
      registeredWorktree: worktreeDetachedNoHead,
      isPathInputTarget: false,
    });

    expect(result.referenceInfo).toBe("detached HEAD");
  });

  it("returns empty referenceInfo when no registered worktree", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/some-dir",
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: true,
    });

    expect(result.referenceInfo).toBe("");
  });

  it("uses absolute targetPath for path input targets", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-feature",
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: true,
    });

    expect(result.displayPath).toBe("/Users/acme/repo-feature");
  });

  it("uses relative path for non-path input targets", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-feature",
      registeredPath: "/Users/acme/repo-feature",
      registeredWorktree: worktreeWithBranch,
      isPathInputTarget: false,
    });

    expect(result.displayPath).toBe("repo-feature");
  });

  it("returns basename as targetDirectoryName", () => {
    const result = getRemovalDisplayInfo({
      cwd: "/Users/acme",
      targetPath: "/Users/acme/repo-feature",
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: false,
    });

    expect(result.targetDirectoryName).toBe("repo-feature");
  });
});
