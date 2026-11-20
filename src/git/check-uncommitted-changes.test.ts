import { afterAll, assert, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkUncommittedChanges } from "./check-uncommitted-changes.js";

function initRepository(directory: string): void {
  const result = spawnSync("git", ["init", "--quiet", directory], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git init failed: ${result.stderr}`);
  }
}

describe("checkUncommittedChanges", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "worktree-remove-uncommitted-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reports no changes for a clean repository", () => {
    const repository = path.join(tempDir, "clean");
    initRepository(repository);

    expect(checkUncommittedChanges(repository)).toStrictEqual({ state: "none" });
  });

  it("reports changes for a repository with an untracked file", async () => {
    const repository = path.join(tempDir, "dirty");
    initRepository(repository);
    await writeFile(path.join(repository, "notes.txt"), "draft");

    expect(checkUncommittedChanges(repository)).toStrictEqual({ state: "present" });
  });

  it("reports an unknown state with Git's error when status cannot run", async () => {
    const worktree = path.join(tempDir, "broken");
    await mkdir(worktree);
    await writeFile(path.join(worktree, ".git"), "gitdir: /nonexistent/worktree-remove-gitdir\n");
    await writeFile(path.join(worktree, "notes.txt"), "draft");

    const result = checkUncommittedChanges(worktree);

    assert(result.state === "unknown");
    expect(result.reason).toMatch(/^fatal: .*\S$/u);
  });
});
