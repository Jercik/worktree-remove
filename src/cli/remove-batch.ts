/**
 * Batch worktree removal orchestration (CLI layer).
 *
 * Confirms once, then removes in parallel.
 */

import pLimit from "p-limit";
import { confirmAction } from "./confirm-action.js";
import type { OutputWriter } from "./output-writer.js";
import { resolveBatchTargets } from "./resolve-batch-targets.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import { exitWithMessage } from "../git/git-helpers.js";
import { isPathEqualOrWithin } from "../worktree/is-path-equal-or-within.js";
import { performWorktreeRemoval } from "../worktree/perform-worktree-removal.js";

type BatchOptions = {
  dryRun: boolean;
  assumeYes: boolean;
  force: boolean;
  allowPrompt: boolean;
  output: OutputWriter;
};

export async function removeBatch(
  targets: string[],
  options: BatchOptions,
): Promise<void> {
  const { dryRun, assumeYes, force, allowPrompt, output } = options;
  const { mainPath, worktrees } = getWorktreeInfo();
  const invocationCwd = process.cwd();

  // Phase 1: Resolve all targets and check uncommitted changes
  const resolved = await resolveBatchTargets({
    targets,
    cwd: invocationCwd,
    mainPath,
    worktrees,
  });

  if (resolved.length === 0) return;

  // Phase 1b: Batch dirty-check prompt
  const dirtyTargets = resolved.filter((r) => r.hasDirtyChanges);
  if (dirtyTargets.length > 0) {
    const dirtyNames = dirtyTargets
      .map((r) => r.displayInfo.targetDirectoryName)
      .join(", ");

    if (force || assumeYes || dryRun) {
      output.warn(
        `${dirtyTargets.length} worktree${dirtyTargets.length > 1 ? "s have" : " has"} uncommitted changes: ${dirtyNames}`,
      );
    } else {
      const proceed = await confirmAction(
        `${dirtyTargets.length} worktree${dirtyTargets.length > 1 ? "s have" : " has"} uncommitted changes (${dirtyNames}). Remove anyway?`,
        {
          allowPrompt,
          assumeYes,
          dryRun,
          promptDisabledMessage:
            "Worktrees have uncommitted changes. Re-run with --yes, --force, or --dry-run to proceed in non-interactive mode.",
        },
      );
      if (!proceed) {
        output.warn("Removal cancelled.");
        return;
      }
    }
  }

  // Phase 2: Single batch confirmation
  const summaryLines = resolved.map((r) => {
    const referenceSuffix = r.displayInfo.referenceInfo
      ? `, ${r.displayInfo.referenceInfo}`
      : "";
    return `  ${r.displayInfo.status} '${r.displayInfo.targetDirectoryName}' (${r.displayInfo.displayPath}${referenceSuffix})`;
  });

  const confirmed = await confirmAction(
    `Remove ${resolved.length} worktrees?\n${summaryLines.join("\n")}`,
    {
      allowPrompt,
      assumeYes,
      dryRun,
      promptDisabledMessage:
        "Confirmation required. Re-run with --yes or --dry-run to proceed in non-interactive mode.",
    },
  );

  if (!confirmed) {
    output.warn("Removal cancelled.");
    return;
  }

  // Phase 2.5: Handle cwd-inside-target
  const cwdInsideAnyTarget = resolved.some((r) =>
    isPathEqualOrWithin({
      basePath: r.targetPath,
      candidatePath: invocationCwd,
      platform: process.platform,
    }),
  );
  const mustSwitchToMain =
    cwdInsideAnyTarget &&
    normalizePathKey(invocationCwd) !== normalizePathKey(mainPath);

  if (mustSwitchToMain) {
    if (dryRun) {
      output.info(
        `Would switch process working directory to '${mainPath}' before removal.`,
      );
      output.warn(
        `Dry run only. In a real run, your shell may still point to the removed directory. Switch it to '${mainPath}' or another existing path.`,
      );
    } else {
      try {
        process.chdir(mainPath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        exitWithMessage(
          `Could not switch working directory to main worktree '${mainPath}': ${reason}`,
        );
      }
      output.info(
        `Switched process working directory to '${mainPath}' before removal.`,
      );
      output.warn(
        `After removal, your shell may still point to a removed directory. Switch it to '${mainPath}' or another existing path.`,
      );
    }
  }

  // Phase 3: Remove targets in parallel (concurrency 4)
  const limit = pLimit(4);
  const results = await Promise.allSettled(
    resolved.map((r) =>
      limit(async () => {
        await performWorktreeRemoval({
          status: r.displayInfo.status,
          targetDirectoryName: r.displayInfo.targetDirectoryName,
          targetPath: r.targetPath,
          mainPath,
          registeredPath: r.registeredPath,
          directoryExistedInitially: r.directoryExists,
          dryRun,
          assumeYes,
          force,
          allowPrompt,
          output,
        });
        return r.displayInfo.targetDirectoryName;
      }),
    ),
  );

  // Phase 4: Report summary
  const succeeded: string[] = [];
  const failed: string[] = [];
  for (const [index, result] of results.entries()) {
    const resolvedEntry = resolved[index];
    if (!resolvedEntry) continue;
    const name = resolvedEntry.displayInfo.targetDirectoryName;
    if (result.status === "fulfilled") {
      succeeded.push(name);
    } else {
      failed.push(name);
      output.error(
        `Failed to remove '${name}': ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
    }
  }

  output.warn(
    `Removed ${succeeded.length} of ${resolved.length} worktree${resolved.length > 1 ? "s" : ""}.`,
  );
  if (failed.length > 0) {
    exitWithMessage(`Failed: ${failed.join(", ")}`);
  }
}
