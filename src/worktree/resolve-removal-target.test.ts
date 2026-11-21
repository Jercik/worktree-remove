import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveRemovalTarget } from "./resolve-removal-target.js";

function runGit(cwd: string, arguments_: string[]): void {
  const result = spawnSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...arguments_],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`git ${arguments_.join(" ")} failed: ${result.stderr}`);
  }
}

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
      lock: undefined,
    };

    const result = await resolveRemovalTarget({
      input: path.join(linkedDirectory, "app-feature"),
      cwd: path.join(realDirectory, "app"),
      mainPath: path.join(realDirectory, "app"),
      commonDir: path.join(realDirectory, "app", ".git"),
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
      commonDir: path.join(realDirectory, "app", ".git"),
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
      commonDir: path.join(realDirectory, "app", ".git"),
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

describe("resolveRemovalTarget for a name no registered worktree matches", () => {
  let parentDirectory: string;
  let mainPath: string;

  beforeAll(async () => {
    parentDirectory = await realpath(await mkdtemp(path.join(tmpdir(), "worktree-remove-name-")));
    mainPath = path.join(parentDirectory, "app");
    runGit(parentDirectory, ["init", "--quiet", "app"]);
    runGit(mainPath, ["commit", "--quiet", "--allow-empty", "-m", "init"]);
    runGit(parentDirectory, ["init", "--quiet", "docs"]);

    const otherPath = path.join(parentDirectory, "other");
    runGit(parentDirectory, ["init", "--quiet", "other"]);
    runGit(otherPath, ["commit", "--quiet", "--allow-empty", "-m", "init"]);
    runGit(otherPath, ["worktree", "add", "--quiet", "-b", "stray", "../other-left"]);
    await rename(path.join(parentDirectory, "other-left"), path.join(parentDirectory, "parked"));
    runGit(otherPath, ["worktree", "prune"]);
    await rename(path.join(parentDirectory, "parked"), path.join(parentDirectory, "other-left"));

    runGit(mainPath, ["worktree", "add", "--quiet", "-b", "left", "../app-left"]);
    await rename(path.join(parentDirectory, "app-left"), path.join(parentDirectory, "parked"));
    runGit(mainPath, ["worktree", "prune"]);
    await rename(path.join(parentDirectory, "parked"), path.join(parentDirectory, "app-left"));
  });

  afterAll(async () => {
    await rm(parentDirectory, { recursive: true, force: true });
  });

  it("resolves to an orphaned worktree of this repository", async () => {
    const result = await resolveRemovalTarget({
      input: "left",
      cwd: mainPath,
      mainPath,
      commonDir: path.join(mainPath, ".git"),
      worktrees: [],
      platform: process.platform,
    });

    expect(result).toStrictEqual({
      targetPath: path.join(parentDirectory, "app-left"),
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: false,
    });
  });

  it("refuses an orphaned worktree of another repository", async () => {
    await expect(
      resolveRemovalTarget({
        input: "other-left",
        cwd: mainPath,
        mainPath,
        commonDir: path.join(mainPath, ".git"),
        worktrees: [],
        platform: process.platform,
      }),
    ).rejects.toThrow(
      "matches 'other-left' but is not a worktree of this repository. Pass its path to remove it anyway.",
    );
  });

  it("resolves the main worktree's directory name to the main worktree", async () => {
    const result = await resolveRemovalTarget({
      input: "app",
      cwd: mainPath,
      mainPath,
      commonDir: path.join(mainPath, ".git"),
      worktrees: [],
      platform: process.platform,
    });

    expect(result).toStrictEqual({
      targetPath: path.join(parentDirectory, "app"),
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: false,
    });
  });

  it("refuses a sibling repository's main checkout", async () => {
    await expect(
      resolveRemovalTarget({
        input: "docs",
        cwd: mainPath,
        mainPath,
        commonDir: path.join(mainPath, ".git"),
        worktrees: [],
        platform: process.platform,
      }),
    ).rejects.toThrow(
      "matches 'docs' but is not a worktree of this repository. Pass its path to remove it anyway.",
    );
  });

  it("resolves the same sibling directory when it is given as a path", async () => {
    const result = await resolveRemovalTarget({
      input: "../docs",
      cwd: mainPath,
      mainPath,
      commonDir: path.join(mainPath, ".git"),
      worktrees: [],
      platform: process.platform,
    });

    expect(result).toStrictEqual({
      targetPath: path.join(parentDirectory, "docs"),
      registeredPath: undefined,
      registeredWorktree: undefined,
      isPathInputTarget: true,
    });
  });
});
