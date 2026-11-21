import { describe, expect, it, vi } from "vitest";
import { createOutputWriter } from "./output-writer.js";
import { removeBatch } from "./remove-batch.js";
import { createRemovalPolicy } from "../removal/removal-policy.js";

vi.mock("../git/get-worktree-info.js", () => ({
  getWorktreeInfo: () => ({
    mainPath: "/Users/acme/repo",
    commonDir: "/Users/acme/repo/.git",
    worktrees: [],
  }),
}));

vi.mock("./resolve-batch-targets.js", () => ({
  resolveBatchTargets: async () => [
    {
      input: "feature",
      targetPath: "/Users/acme/repo-feature",
      registeredPath: "/Users/acme/repo-feature",
      registeredWorktree: undefined,
      isPathInputTarget: false,
      directoryExists: true,
      uncommittedChanges: { state: "none" },
      displayInfo: {
        status: "worktree",
        targetDirectoryName: "repo-feature",
        displayPath: "../repo-feature",
        referenceInfo: undefined,
      },
    },
  ],
}));

vi.mock("../worktree/perform-worktree-removal.js", () => ({
  performWorktreeRemoval: async () => {
    throw new Error("EACCES: permission denied, rmdir '/Users/acme/repo-feature'");
  },
}));

describe("removeBatch", () => {
  it("reports the error that stopped a single-target removal", async () => {
    await expect(
      removeBatch(["feature"], {
        policy: createRemovalPolicy({
          dryRun: false,
          assumeYes: true,
          force: false,
          allowPrompt: false,
        }),
        output: createOutputWriter({ dryRun: false, verbose: false, quiet: true }),
      }),
    ).rejects.toThrow("EACCES: permission denied, rmdir '/Users/acme/repo-feature'");
  });
});
