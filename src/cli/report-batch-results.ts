import type { PerformWorktreeRemovalResult } from "../worktree/perform-worktree-removal.js";
import { exitWithMessage } from "../git/git-helpers.js";
import type { OutputWriter } from "./output-writer.js";

type BatchResultEntry = {
  name: string;
  result: PromiseSettledResult<PerformWorktreeRemovalResult>;
};

export function reportBatchResults(
  entries: BatchResultEntry[],
  options: { dryRun: boolean; output: OutputWriter },
): void {
  const { dryRun, output } = options;
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const { name, result } of entries) {
    if (result.status === "fulfilled" && result.value.status === "ok") {
      succeeded.push(name);
    } else {
      failed.push(name);
      if (result.status === "rejected") {
        output.error(
          `Failed to remove '${name}': ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
      } else {
        output.error(`Failed to remove '${name}'.`);
      }
    }
  }

  const verb = dryRun ? "Would remove" : "Removed";
  output.warn(`${verb} ${succeeded.length} of ${entries.length} worktrees.`);
  if (failed.length > 0) {
    exitWithMessage(`Failed: ${failed.join(", ")}`);
  }
}
