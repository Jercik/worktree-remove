import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveRemovalTarget } from "./resolve-removal-target.js";

describe("resolveRemovalTarget through a symlinked directory", () => {
  let realDirectory: string;
  let linkedDirectory: string;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await realpath(await mkdtemp(path.join(tmpdir(), "worktree-remove-symlink-")));
    realDirectory = path.join(tempDir, "real");
    linkedDirectory = path.join(tempDir, "linked");
    await mkdir(path.join(realDirectory, "app"), { recursive: true });
    await mkdir(path.join(realDirectory, "app-feature"));
    await mkdir(path.join(tempDir, "elsewhere"));
    await symlink(realDirectory, linkedDirectory, "dir");
    await symlink(path.join(tempDir, "elsewhere"), path.join(realDirectory, "shortcut"), "dir");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("matches a registered worktree addressed through a symlinked parent", async () => {
    const worktree = {
      path: path.join(realDirectory, "app-feature"),
      head: "2222222222222222222222222222222222222222",
      branch: "feature",
      isDetached: false,
    };

    const result = await resolveRemovalTarget({
      input: path.join(linkedDirectory, "app-feature"),
      cwd: path.join(realDirectory, "app"),
      mainPath: path.join(realDirectory, "app"),
      worktrees: [worktree],
      platform: process.platform,
    });

    expect(result).toStrictEqual({
      targetPath: path.join(realDirectory, "app-feature"),
      registeredPath: path.join(realDirectory, "app-feature"),
      registeredWorktree: worktree,
      isPathInputTarget: true,
    });
  });

  it("resolves the main worktree addressed through a symlinked parent to its real path", async () => {
    const result = await resolveRemovalTarget({
      input: path.join(linkedDirectory, "app"),
      cwd: path.join(realDirectory, "app"),
      mainPath: path.join(realDirectory, "app"),
      worktrees: [],
      platform: process.platform,
    });

    expect(result.targetPath).toBe(path.join(realDirectory, "app"));
  });

  it("keeps an unregistered symlink as the target instead of the directory it points to", async () => {
    const result = await resolveRemovalTarget({
      input: path.join(linkedDirectory, "shortcut"),
      cwd: path.join(realDirectory, "app"),
      mainPath: path.join(realDirectory, "app"),
      worktrees: [],
      platform: process.platform,
    });

    expect(result).toStrictEqual({
      targetPath: path.join(realDirectory, "shortcut"),
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: true,
    });
  });
});
