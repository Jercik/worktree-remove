/**
 * Batch worktree removal orchestration (CLI layer).
 *
 * Confirms once, then removes in parallel.
 */

import pLimit from "p-limit";
import { confirmAction } from "./confirm-action.js";
import { formatUncommittedChangesWarning } from "./format-uncommitted-changes-warning.js";
import { prepareCwdSwitch } from "./handle-cwd-switch.js";
import type { OutputWriter } from "./output-writer.js";
import { prefixOutput } from "./output-writer.js";
import { reportBatchResults } from "./report-batch-results.js";
import type { BatchResultEntry } from "./report-batch-results.js";
import { resolveBatchTargets, type ResolvedTarget } from "./resolve-batch-targets.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import type { RemovalPolicy } from "../removal/removal-policy.js";
import { performWorktreeRemoval } from "../worktree/perform-worktree-removal.js";

interface BatchOptions {
  policy: RemovalPolicy;
  output: OutputWriter;
}

export async function removeBatch(targets: string[], options: BatchOptions): Promise<void> {
  const { policy, output } = options;
  const { mainPath, commonDir, worktrees } = getWorktreeInfo();
  const invocationCwd = process.cwd();

  // Phase 1: Resolve all targets and check uncommitted changes
  const resolved = await resolveBatchTargets({
    targets,
    cwd: invocationCwd,
    mainPath,
    commonDir,
    worktrees,
  });

  const [firstTarget] = resolved;
  if (!firstTarget) {
    throw new Error("No valid targets to remove.");
  }

  // Phase 1b: Batch dirty-check prompt
  const uncommittedChangesWarning = formatUncommittedChangesWarning(
    resolved.map((r) => ({
      name: r.displayInfo.targetDirectoryName,
      uncommittedChanges: r.uncommittedChanges,
    })),
  );
  if (uncommittedChangesWarning.length > 0) {
    if (policy.shouldWarnInsteadOfPrompt()) {
      for (const line of uncommittedChangesWarning) {
        output.warn(line);
      }
    } else {
      const warning = uncommittedChangesWarning.join("\n");
      const proceed = await confirmAction(`${warning}\nRemove anyway?`, {
        policy,
        promptDisabledMessage: `${warning}\nRe-run with --yes, --force, or --dry-run to proceed in non-interactive mode.`,
      });
      if (!proceed) {
        output.notice("Removal cancelled.");
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
    output.notice("Removal cancelled.");
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
    for (const { result } of settled) {
      if (result.status === "rejected") {
        throw result.reason;
      }
      if (result.value.status === "failed") {
        throw new Error(`Failed to remove '${firstTarget.displayInfo.targetDirectoryName}'.`);
      }
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
