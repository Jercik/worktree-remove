import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeTerminal } from "./fake-terminal.test.helper.js";
import { createOutputWriter } from "./output-writer.js";
import { selectWorktrees } from "./select-worktree.js";

vi.mock(import("../git/get-worktree-info.js"), () => ({
  getWorktreeInfo: () => ({
    mainPath: "/projects/app",
    worktrees: [
      {
        path: "/projects/app-feature",
        head: "0123456789abcdef0123456789abcdef01234567",
        branch: "feature",
        isDetached: false,
        lock: undefined,
      },
    ],
  }),
}));

describe("selectWorktrees", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits with status 130 when Ctrl+C is pressed at the selection prompt", async () => {
    const terminal = installFakeTerminal();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const exited = new Error("process.exit called");
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw exited;
    });

    const selection = selectWorktrees(
      createOutputWriter({ dryRun: false, verbose: false, quiet: true }),
    );
    terminal.type("\u0003");

    await expect(selection).rejects.toBe(exited);
    expect(exit).toHaveBeenCalledWith(130);
    expect(consoleError).toHaveBeenCalledWith("\nInterrupted");
  });
});
