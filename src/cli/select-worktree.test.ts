import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOutputWriter } from "./output-writer.js";
import { selectWorktrees } from "./select-worktree.js";

function fakeTerminal(): PassThrough {
  return Object.assign(new PassThrough(), {
    isTTY: true,
    columns: 80,
    rows: 24,
    setRawMode: () => {},
  });
}

describe("selectWorktrees", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "worktree-remove-select-"));
    const mainPath = path.join(tempDir, "main");
    execFileSync("git", ["init", "--quiet", mainPath]);
    execFileSync("git", [
      "-C",
      mainPath,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--quiet",
      "--allow-empty",
      "--message",
      "init",
    ]);
    execFileSync("git", [
      "-C",
      mainPath,
      "worktree",
      "add",
      "--quiet",
      "-b",
      "feature",
      path.join(tempDir, "feature"),
    ]);
    originalCwd = process.cwd();
    process.chdir(mainPath);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("exits with status 130 when Ctrl+C is pressed at the selection prompt", async () => {
    const stdin = fakeTerminal();
    vi.spyOn(process, "stdin", "get").mockReturnValue(stdin as unknown as typeof process.stdin);
    vi.spyOn(process, "stderr", "get").mockReturnValue(
      fakeTerminal() as unknown as typeof process.stderr,
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockReturnValue(undefined as never);

    const selection = selectWorktrees(
      createOutputWriter({ dryRun: false, verbose: false, quiet: true }),
    );
    stdin.write("\u0003");
    await expect(selection).rejects.toThrow("User force closed the prompt with SIGINT");

    expect(exit).toHaveBeenCalledWith(130);
    expect(consoleError).toHaveBeenCalledWith("\nInterrupted");
  });
});
