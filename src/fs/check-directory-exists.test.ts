import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { directoryExists } from "./check-directory-exists.js";

describe("directoryExists", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "worktree-remove-dir-exists-"));
    await mkdir(path.join(tempDir, "subdir"));
    await writeFile(path.join(tempDir, "file.txt"), "content");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns true for an existing directory", async () => {
    await expect(directoryExists(path.join(tempDir, "subdir"))).resolves.toBe(true);
  });

  it("returns false for a file", async () => {
    await expect(directoryExists(path.join(tempDir, "file.txt"))).resolves.not.toBe(true);
  });

  it("returns false for a non-existent path", async () => {
    await expect(directoryExists(path.join(tempDir, "does-not-exist"))).resolves.not.toBe(true);
  });
});
