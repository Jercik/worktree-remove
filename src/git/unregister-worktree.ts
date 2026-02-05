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

export type UnregisterResult =
  | { ok: true }
  | { ok: false; reason: string | undefined };

export function unregisterWorktree(
  mainPath: string,
  worktreePath: string,
  options: UnregisterWorktreeOptions,
): UnregisterResult {
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
    return { ok: true };
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);

    if (options.force) {
      try {
        runRemove(true);
        return { ok: true };
      } catch (forceError) {
        message =
          forceError instanceof Error ? forceError.message : String(forceError);
      }
    }

    if (/use --force to delete it/u.test(message)) {
      return {
        ok: false,
        reason: "worktree has local modifications; re-run with --force",
      };
    }

    if (
      /is not a working tree/u.test(message) ||
      /No such file or directory/u.test(message) ||
      /does not exist/u.test(message)
    ) {
      // Directory already gone or not recognized; prune admin entries
      try {
        git("-C", mainPath, "worktree", "prune");
        return { ok: true };
      } catch {
        return { ok: false, reason: undefined };
      }
    }

    return { ok: false, reason: undefined };
  }
}
