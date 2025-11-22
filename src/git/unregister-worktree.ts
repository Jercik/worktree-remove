/**
 * Unregister a worktree from Git (without deleting the directory)
 */

import { git } from "./git-helpers.js";

export function unregisterWorktree(
  mainPath: string,
  worktreePath: string,
): boolean {
  const runRemove = (force: boolean) => {
    git(
      "-C",
      mainPath,
      "worktree",
      "remove",
      ...(force ? ["--force"] : []),
      worktreePath,
    );
  };

  try {
    runRemove(true);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = message.trim() || "unknown error";

    if (/failed to delete.*Directory not empty/u.test(message)) {
      try {
        runRemove(false);
        return true;
      } catch (retryError) {
        const retryMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        const retryDetails = retryMessage.trim() || "unknown error";
        console.warn(
          `  ⚠️  git worktree remove ${worktreePath} failed: ${retryDetails}`,
        );
        return false;
      }
    }

    if (
      /is not a working tree/u.test(message) ||
      /No such file or directory/u.test(message) ||
      /does not exist/u.test(message)
    ) {
      // Directory already gone or not recognized; prune admin entries
      try {
        git("-C", mainPath, "worktree", "prune");
        return true;
      } catch (pruneError) {
        const pruneMessage =
          pruneError instanceof Error ? pruneError.message : String(pruneError);
        console.warn(
          `  ⚠️  git worktree prune failed after removal: ${
            pruneMessage.trim() || "unknown error"
          }`,
        );
        return false;
      }
    }

    console.warn(
      `  ⚠️  git worktree remove ${worktreePath} failed: ${details}`,
    );
    return false;
  }
}
