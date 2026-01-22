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
import {
  exitWithMessage,
  normalizeBranchName,
  confirm,
} from "../git/git-helpers.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import { hasUncommittedChanges } from "../git/check-uncommitted-changes.js";
import { unregisterWorktree } from "../git/unregister-worktree.js";
import { directoryExists } from "../fs/check-directory-exists.js";
import { trashDirectory } from "../fs/trash-directory.js";

type RemoveWorktreeOptions = {
  skipConfirmations?: boolean;
};

export async function removeWorktree(
  inputBranch: string,
  options: RemoveWorktreeOptions = {},
): Promise<void> {
  const { skipConfirmations = false } = options;
  const targetBranch = normalizeBranchName(inputBranch);

  // Get worktree information
  const { mainPath, worktrees } = getWorktreeInfo();

  // Ensure we're running from the main worktree
  const cwd = process.cwd();
  if (path.resolve(cwd) !== path.resolve(mainPath)) {
    exitWithMessage(
      "This command must be run from the main repository worktree.",
    );
  }

  // Determine the expected directory path
  const mainRepoName = path.basename(mainPath);
  const expectedDirectoryName = `${mainRepoName}-${targetBranch}`;
  const parentDirectory = path.dirname(mainPath);
  const expectedPath = path.join(parentDirectory, expectedDirectoryName);

  // Check if worktree is registered
  const registeredPath = worktrees.get(targetBranch);

  // Determine the actual path to work with (registered or expected)
  const targetPath = registeredPath || expectedPath;
  const targetDirectoryName = path.basename(targetPath);

  // Check if directory exists
  const directoryExists_ = await directoryExists(targetPath);

  if (!registeredPath && !directoryExists_) {
    exitWithMessage(
      `No worktree or directory found for branch '${targetBranch}'.`,
    );
  }

  // Safety check: don't remove the main worktree
  if (path.resolve(targetPath) === path.resolve(mainPath)) {
    exitWithMessage("Refusing to remove the main worktree.");
  }

  // Check for uncommitted changes if it's a registered worktree
  if (
    !skipConfirmations &&
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
  if (!skipConfirmations) {
    const confirmed = await confirm(
      `Remove ${status} '${targetDirectoryName}' (branch ${targetBranch})?`,
    );

    if (!confirmed) {
      console.log("Removal cancelled.");
      return;
    }
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
    const trashConfirmed =
      skipConfirmations ||
      !registeredPath || // Always trash orphaned directories if user confirmed above
      (await confirm(`Move directory '${targetDirectoryName}' to trash?`));

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
