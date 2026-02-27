/**
 * Batch worktree removal orchestration (CLI layer).
 *
 * Confirms once, then removes in parallel.
 */

import pLimit from "p-limit";
import { confirmAction } from "./confirm-action.js";
import { prepareCwdSwitch } from "./handle-cwd-switch.js";
import type { OutputWriter } from "./output-writer.js";
import { prefixOutput } from "./output-writer.js";
import { reportBatchResults } from "./report-batch-results.js";
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

  if (resolved.length === 0) {
    exitWithMessage("No valid targets to remove.");
  }

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
    targets: resolved.map((r) => ({
      path: r.targetPath,
      name: r.displayInfo.targetDirectoryName,
    })),
    invocationCwd,
    mainPath,
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
          force,
          allowPrompt,
          output: isSingleTarget
            ? output
            : prefixOutput(output, r.displayInfo.targetDirectoryName),
          // Suppress the interactive trash-failure prompt for multi-target
          // batches to prevent concurrent readline races on stdin. The user
          // already confirmed removal in Phase 2; if trash fails without
          // --force, the target is reported as failed instead of silently
          // proceeding with a destructive git unregister.
          skipTrashFailurePrompt: !isSingleTarget,
        }),
      ),
    ),
  );

  // Phase 4: Report summary (skip for single targets — performWorktreeRemoval
  // already reports its own outcome, but still check exit code)
  if (isSingleTarget) {
    const singleResult = results[0];
    if (
      !singleResult ||
      singleResult.status === "rejected" ||
      singleResult.value.status === "failed"
    ) {
      exitWithMessage(
        `Failed to remove '${firstTarget?.displayInfo.targetDirectoryName ?? "target"}'.`,
      );
    }
    // "cancelled" — user declined a prompt; exit cleanly (code 0)
  } else {
    const entries = results.map((result, index) => ({
      name:
        resolved[index]?.displayInfo.targetDirectoryName ?? "unknown target",
      result,
    }));
    reportBatchResults(entries, { dryRun, output });
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
