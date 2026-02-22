/**
 * Main worktree removal use case (domain layer).
 *
 * Orchestrates:
 * - Resolving the target worktree path
 * - Guard rails around uncommitted changes
 * - Unregistering the worktree
 * - Moving the directory to trash
 */

import { confirmAction } from "../cli/confirm-action.js";
import type { OutputWriter } from "../cli/output-writer.js";
import { exitWithMessage } from "../git/git-helpers.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import { hasUncommittedChanges } from "../git/check-uncommitted-changes.js";
import { directoryExists } from "../fs/check-directory-exists.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";
import { assertRemovalSafe } from "./assert-removal-safe.js";
import { getRemovalDisplayInfo } from "./get-removal-display.js";
import { isPathEqualOrWithin } from "./is-path-equal-or-within.js";
import { performWorktreeRemoval } from "./perform-worktree-removal.js";
import { resolveRemovalTarget } from "./resolve-removal-target.js";

type RemoveWorktreeOptions = {
  dryRun: boolean;
  assumeYes: boolean;
  force: boolean;
  allowPrompt: boolean;
  output: OutputWriter;
};

export async function removeWorktree(
  input: string,
  options: RemoveWorktreeOptions,
): Promise<void> {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    exitWithMessage("No branch or path specified.");
  }

  // Get worktree information
  const { mainPath, worktrees } = getWorktreeInfo();
  const invocationCwd = process.cwd();

  const resolvedTarget = await resolveRemovalTarget({
    input: trimmedInput,
    cwd: invocationCwd,
    mainPath,
    worktrees,
    platform: process.platform,
  });
  const { targetPath, registeredPath, registeredWorktree, isPathInputTarget } =
    resolvedTarget;
  const directoryExists_ = await directoryExists(targetPath);

  assertRemovalSafe({ targetPath, mainPath, registeredPath });

  // Check for uncommitted changes if it's a registered worktree
  if (
    registeredPath &&
    directoryExists_ &&
    hasUncommittedChanges(registeredPath)
  ) {
    if (options.force || options.assumeYes || options.dryRun) {
      options.output.warn("Worktree has uncommitted changes.");
    } else {
      const proceed = await confirmAction(
        "Worktree has uncommitted changes. Remove anyway?",
        {
          allowPrompt: options.allowPrompt,
          assumeYes: options.assumeYes,
          dryRun: options.dryRun,
          promptDisabledMessage:
            "Worktree has uncommitted changes. Re-run with --yes, --force, or --dry-run to proceed in non-interactive mode.",
        },
      );
      if (!proceed) {
        options.output.warn("Removal cancelled.");
        return;
      }
    }
  }

  // Get user confirmation
  const { status, referenceInfo, displayPath, targetDirectoryName } =
    getRemovalDisplayInfo({
      cwd: invocationCwd,
      targetPath,
      registeredPath,
      registeredWorktree,
      isPathInputTarget,
    });
  const runningInsideTarget = isPathEqualOrWithin({
    basePath: targetPath,
    candidatePath: invocationCwd,
    platform: process.platform,
  });
  const mustSwitchToMainBeforeRemoval =
    runningInsideTarget &&
    normalizePathKey(invocationCwd) !== normalizePathKey(mainPath);

  if (mustSwitchToMainBeforeRemoval) {
    const switchVerb = options.dryRun ? "would" : "will";
    options.output.warn(
      `Current directory is inside '${targetDirectoryName}'. The command ${switchVerb} switch to '${mainPath}' before removing it, and your shell directory will not change.`,
    );
  }

  const referenceSuffix = referenceInfo ? `, ${referenceInfo}` : "";
  const confirmed = await confirmAction(
    `Remove ${status} '${targetDirectoryName}' (${displayPath}${referenceSuffix})?`,
    {
      allowPrompt: options.allowPrompt,
      assumeYes: options.assumeYes,
      dryRun: options.dryRun,
      promptDisabledMessage:
        "Confirmation required. Re-run with --yes or --dry-run to proceed in non-interactive mode.",
    },
  );

  if (!confirmed) {
    options.output.warn("Removal cancelled.");
    return;
  }

  if (mustSwitchToMainBeforeRemoval) {
    if (options.dryRun) {
      options.output.info(
        `Would switch process working directory to '${mainPath}' before removal.`,
      );
      options.output.warn(
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
      options.output.info(
        `Switched process working directory to '${mainPath}' before removal.`,
      );
      options.output.warn(
        `After removal, your shell may still point to a removed directory. Switch it to '${mainPath}' or another existing path.`,
      );
    }
  }

  await performWorktreeRemoval({
    status,
    targetDirectoryName,
    targetPath,
    mainPath,
    registeredPath,
    directoryExistedInitially: directoryExists_,
    dryRun: options.dryRun,
    assumeYes: options.assumeYes,
    force: options.force,
    allowPrompt: options.allowPrompt,
    output: options.output,
  });
}
