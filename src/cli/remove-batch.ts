/**
 * Batch worktree removal orchestration (CLI layer).
 *
 * Confirms once, then removes in parallel.
 */

import pLimit from "p-limit";
import { confirmAction } from "./confirm-action.js";
import { prepareCwdSwitch } from "./handle-cwd-switch.js";
import type { OutputWriter } from "./output-writer.js";
import {
  resolveBatchTargets,
  type ResolvedTarget,
} from "./resolve-batch-targets.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import { exitWithMessage } from "../git/git-helpers.js";
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

  // Phase 2: Confirmation
  const isSingleTarget = resolved.length === 1;
  const firstTarget = resolved[0];

  // For a single target, show the same compact prompt as the old single-target flow.
  // For multiple targets, show a numbered list.
  const confirmationMessage =
    isSingleTarget && firstTarget
      ? formatSingleConfirmation(firstTarget)
      : formatBatchConfirmation(resolved);

  const performCwdSwitch = prepareCwdSwitch({
    targetPaths: resolved.map((r) => r.targetPath),
    invocationCwd,
    mainPath,
    targetName:
      firstTarget?.displayInfo.targetDirectoryName ?? "a target directory",
    dryRun,
    output,
  });

  const confirmed = await confirmAction(confirmationMessage, {
    allowPrompt,
    assumeYes,
    dryRun,
    promptDisabledMessage:
      "Confirmation required. Re-run with --yes or --dry-run to proceed in non-interactive mode.",
  });

  if (!confirmed) {
    output.warn("Removal cancelled.");
    return;
  }

  performCwdSwitch?.();

  // Phase 3: Remove targets in parallel (concurrency 4)
  // Force-skip internal prompts for multi-target batches: the user already
  // confirmed in Phase 2, and concurrent readline prompts would race on stdin.
  const forceInternalPrompts = isSingleTarget ? force : true;
  const limit = pLimit(4);
  const results = await Promise.allSettled(
    resolved.map((r) =>
      limit(() =>
        performWorktreeRemoval({
          status: r.displayInfo.status,
          targetDirectoryName: r.displayInfo.targetDirectoryName,
          targetPath: r.targetPath,
          mainPath,
          registeredPath: r.registeredPath,
          directoryExistedInitially: r.directoryExists,
          dryRun,
          assumeYes,
          force: forceInternalPrompts,
          allowPrompt,
          output,
        }),
      ),
    ),
  );

  // Phase 4: Report summary (skip for single targets — performWorktreeRemoval
  // already reports its own outcome)
  if (!isSingleTarget) {
    const succeeded: string[] = [];
    const failed: string[] = [];
    for (const [index, result] of results.entries()) {
      const resolvedEntry = resolved[index];
      if (!resolvedEntry) continue;
      const name = resolvedEntry.displayInfo.targetDirectoryName;
      if (result.status === "fulfilled" && result.value.ok) {
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
    output.warn(`${verb} ${succeeded.length} of ${resolved.length} worktrees.`);
    if (failed.length > 0) {
      exitWithMessage(`Failed: ${failed.join(", ")}`);
    }
  }
}

function formatSingleConfirmation(target: ResolvedTarget): string {
  const { status, displayPath, targetDirectoryName, referenceInfo } =
    target.displayInfo;
  const referenceSuffix = referenceInfo ? `, ${referenceInfo}` : "";
  return `Remove ${status} '${targetDirectoryName}' (${displayPath}${referenceSuffix})?`;
}

function formatBatchConfirmation(targets: ResolvedTarget[]): string {
  const summaryLines = targets.map((r) => {
    const referenceSuffix = r.displayInfo.referenceInfo
      ? `, ${r.displayInfo.referenceInfo}`
      : "";
    return `  ${r.displayInfo.status} '${r.displayInfo.targetDirectoryName}' (${r.displayInfo.displayPath}${referenceSuffix})`;
  });
  return `Remove ${targets.length} worktrees?\n${summaryLines.join("\n")}`;
}
