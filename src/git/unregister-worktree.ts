/**
 * Unregister a worktree from Git.
 *
 * Uses `git worktree remove` (and falls back to `git worktree prune`) to remove
 * the worktree registration from the main repository. Git may delete the
 * worktree directory if it still exists.
 */

import { git } from "./git-helpers.js";

export type UnregisterWorktreeOptions = {
  force: boolean;
};

export function unregisterWorktree(
  mainPath: string,
  worktreePath: string,
  options: UnregisterWorktreeOptions,
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
    runRemove(false);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/use --force to delete it/u.test(message)) {
      if (!options.force) return false;
      try {
        runRemove(true);
        return true;
      } catch {
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
      } catch {
        return false;
      }
    }

    return false;
  }
}
