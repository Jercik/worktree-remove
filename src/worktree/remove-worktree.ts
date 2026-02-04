/**
 * Main worktree removal use case (domain layer).
 *
 * Orchestrates:
 * - Validating execution from the main worktree
 * - Resolving the target worktree path
 * - Guard rails around uncommitted changes
 * - Unregistering the worktree
 * - Moving the directory to trash
 */

import path from "node:path";
import { exitWithMessage, confirm } from "../git/git-helpers.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import { hasUncommittedChanges } from "../git/check-uncommitted-changes.js";
import { unregisterWorktree } from "../git/unregister-worktree.js";
import { directoryExists } from "../fs/check-directory-exists.js";
import { trashDirectory } from "../fs/trash-directory.js";
import { resolveWorktreeTarget } from "./resolve-worktree-target.js";

function shortHash(hash: string | undefined): string | undefined {
  if (!hash) return undefined;
  return hash.length <= 7 ? hash : hash.slice(0, 7);
}

export async function removeWorktree(input: string): Promise<void> {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    exitWithMessage("No branch or path specified.");
  }

  // Get worktree information
  const { mainPath, worktrees } = getWorktreeInfo();

  // Ensure we're running from the main worktree
  const cwd = process.cwd();
  if (path.resolve(cwd) !== path.resolve(mainPath)) {
    exitWithMessage(
      "This command must be run from the main repository worktree.",
    );
  }

  const resolvedTarget = resolveWorktreeTarget({
    input: trimmedInput,
    cwd,
    mainPath,
    worktrees,
  });

  if (resolvedTarget.kind === "ambiguous") {
    exitWithMessage(resolvedTarget.message);
  }

  let registeredPath: string | undefined;
  const registeredWorktreeFinal =
    resolvedTarget.kind === "registered" ? resolvedTarget.worktree : undefined;
  let targetPath: string;

  if (resolvedTarget.kind === "registered") {
    registeredPath = resolvedTarget.worktree.path;
    targetPath = resolvedTarget.worktree.path;
  } else {
    let existingPath: string | undefined;

    for (const candidatePath of resolvedTarget.candidatePaths) {
      if (await directoryExists(candidatePath)) {
        existingPath = candidatePath;
        break;
      }
    }

    if (!existingPath) {
      exitWithMessage(
        resolvedTarget.isPathInput
          ? `No worktree or directory found at '${resolvedTarget.resolvedInputPath}'.`
          : `No worktree or directory found for '${resolvedTarget.input}'.`,
      );
    }

    targetPath = existingPath;
  }

  const targetDirectoryName = path.basename(targetPath);

  // Check if directory exists
  const directoryExists_ = await directoryExists(targetPath);

  // Safety check: don't remove the main worktree
  if (path.resolve(targetPath) === path.resolve(mainPath)) {
    exitWithMessage("Refusing to remove the main worktree.");
  }

  // Check for uncommitted changes if it's a registered worktree
  if (
    registeredPath &&
    directoryExists_ &&
    hasUncommittedChanges(registeredPath)
  ) {
    const proceed = await confirm(
      "Worktree has uncommitted changes. Remove anyway?",
    );
    if (!proceed) {
      console.log("Removal cancelled.");
      return;
    }
  }

  // Get user confirmation
  const status = registeredPath ? "registered worktree" : "orphaned directory";
  const referenceInfo = (() => {
    if (!registeredWorktreeFinal || !registeredPath) return "";
    if (registeredWorktreeFinal.branch)
      return ` (branch ${registeredWorktreeFinal.branch})`;
    const head = shortHash(registeredWorktreeFinal.head);
    return head ? ` (detached HEAD @ ${head})` : " (detached HEAD)";
  })();

  const displayPath = path.relative(cwd, targetPath) || targetPath;
  const confirmed = await confirm(
    `Remove ${status} '${targetDirectoryName}' (${displayPath})${referenceInfo}?`,
  );

  if (!confirmed) {
    console.log("Removal cancelled.");
    return;
  }

  console.log(`➤ Removing ${status} '${targetDirectoryName}'...`);

  // Step 1: Unregister from Git first (let Git delete the directory if it wants)
  if (registeredPath) {
    console.log("  • Unregistering from Git...");
    const unregistered = unregisterWorktree(mainPath, registeredPath);
    if (unregistered) {
      console.log("  ✓ Unregistered from Git");
    } else {
      console.log(
        "  ⚠️  Could not fully unregister from Git (may be partially removed)",
      );
    }
  }

  // Step 2: If directory still exists, move it to trash
  // Re-check existence since git worktree remove may have deleted it
  const directoryExistsNow = await directoryExists(targetPath);

  if (!directoryExistsNow && directoryExists_) {
    // Directory was deleted by git worktree remove
    console.log("  ✓ Directory was removed by Git");
  } else if (directoryExistsNow) {
    // Directory still exists, offer to trash it
    const trashConfirmed = registeredPath
      ? await confirm(`Move directory '${targetDirectoryName}' to trash?`)
      : true; // Always trash orphaned directories if user confirmed above

    if (trashConfirmed) {
      console.log("  • Moving directory to trash...");
      const movedToTrash = await trashDirectory(targetPath);
      if (movedToTrash) {
        console.log("  ✓ Directory moved to trash");
      } else {
        console.log(
          "  ⚠️  Could not move directory to trash - remove manually",
        );
      }
    } else {
      console.log("  • Directory retained");
    }
  } else {
    // Directory never existed
    console.log("  ℹ Directory did not exist");
  }

  console.log("✔ Done!");
}
