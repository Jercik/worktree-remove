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
import type { BatchResultEntry } from "./report-batch-results.js";
import { resolveBatchTargets, type ResolvedTarget } from "./resolve-batch-targets.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import { exitWithMessage } from "../git/git-helpers.js";
import type { RemovalPolicy } from "../removal/removal-policy.js";
import { performWorktreeRemoval } from "../worktree/perform-worktree-removal.js";

interface BatchOptions {
  policy: RemovalPolicy;
  output: OutputWriter;
}

export async function removeBatch(targets: string[], options: BatchOptions): Promise<void> {
  const { policy, output } = options;
  const { mainPath, worktrees } = getWorktreeInfo();
  const invocationCwd = process.cwd();

  // Phase 1: Resolve all targets and check uncommitted changes
  const resolved = await resolveBatchTargets({
    targets,
    cwd: invocationCwd,
    mainPath,
    worktrees,
  });

  const [firstTarget] = resolved;
  if (!firstTarget) {
    exitWithMessage("No valid targets to remove.");
  }

  // Phase 1b: Batch dirty-check prompt
  const dirtyTargets = resolved.filter((r) => r.hasDirtyChanges);
  if (dirtyTargets.length > 0) {
    const dirtyNames = dirtyTargets.map((r) => r.displayInfo.targetDirectoryName).join(", ");

    if (policy.shouldWarnInsteadOfPrompt()) {
      output.warn(
        `${dirtyTargets.length} worktree${dirtyTargets.length > 1 ? "s have" : " has"} uncommitted changes: ${dirtyNames}`,
      );
    } else {
      const proceed = await confirmAction(
        `${dirtyTargets.length} worktree${dirtyTargets.length > 1 ? "s have" : " has"} uncommitted changes (${dirtyNames}). Remove anyway?`,
        {
          policy,
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
  const confirmationMessage = isSingleTarget
    ? formatSingleConfirmation(firstTarget)
    : formatBatchConfirmation(resolved);

  const performCwdSwitch = prepareCwdSwitch({
    targets: resolved.map((r) => ({
      path: r.targetPath,
      name: r.displayInfo.targetDirectoryName,
    })),
    invocationCwd,
    mainPath,
    dryRun: policy.dryRun,
    output,
  });

  const confirmed = await confirmAction(confirmationMessage, {
    policy,
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
  const settled = await Promise.all(
    resolved.map((target) =>
      limit(async (): Promise<BatchResultEntry> => {
        const name = target.displayInfo.targetDirectoryName;
        try {
          const value = await performWorktreeRemoval({
            status: target.displayInfo.status,
            targetDirectoryName: name,
            targetPath: target.targetPath,
            mainPath,
            registeredPath: target.registeredPath,
            directoryExistedInitially: target.directoryExists,
            policy,
            output: isSingleTarget ? output : prefixOutput(output, name),
            // Suppress the interactive trash-failure prompt for multi-target
            // batches to prevent concurrent readline races on stdin. The user
            // already confirmed removal in Phase 2; if trash fails without
            // --force, the target is reported as failed instead of silently
            // proceeding with a destructive git unregister.
            skipTrashFailurePrompt: !isSingleTarget,
          });
          return { name, result: { status: "fulfilled", value } };
        } catch (error) {
          return { name, result: { status: "rejected", reason: error } };
        }
      }),
    ),
  );

  // Phase 4: Report summary (skip for single targets — performWorktreeRemoval
  // already reports its own outcome, but still check exit code)
  if (isSingleTarget) {
    const failed = settled.some(
      (entry) => entry.result.status === "rejected" || entry.result.value.status === "failed",
    );
    if (failed) {
      exitWithMessage(`Failed to remove '${firstTarget.displayInfo.targetDirectoryName}'.`);
    }
    // "cancelled" — user declined a prompt; exit cleanly (code 0)
  } else {
    reportBatchResults(settled, { dryRun: policy.dryRun, output });
  }
}

function formatSingleConfirmation(target: ResolvedTarget): string {
  const { status, displayPath, targetDirectoryName, referenceInfo } = target.displayInfo;
  const referenceSuffix = referenceInfo ? `, ${referenceInfo}` : "";
  return `Remove ${status} '${targetDirectoryName}' (${displayPath}${referenceSuffix})?`;
}

function formatBatchConfirmation(targets: ResolvedTarget[]): string {
  const summaryLines = targets.map((r) => {
    const referenceSuffix = r.displayInfo.referenceInfo ? `, ${r.displayInfo.referenceInfo}` : "";
    return `  ${r.displayInfo.status} '${r.displayInfo.targetDirectoryName}' (${r.displayInfo.displayPath}${referenceSuffix})`;
  });
  return `Remove ${targets.length} worktrees?\n${summaryLines.join("\n")}`;
}
