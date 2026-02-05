/**
 * Get worktree information from git
 */

import { git, exitWithMessage } from "./git-helpers.js";
import { normalizeGitPath } from "./normalize-git-path.js";
import { parseWorktreeListPorcelain } from "./parse-worktree-list.js";
import type { WorktreeEntry } from "./parse-worktree-list.js";

interface WorktreeInfo {
  mainPath: string;
  worktrees: WorktreeEntry[]; // excludes main
}

export function getWorktreeInfo(): WorktreeInfo {
  const wtList = (() => {
    try {
      return {
        output: git("worktree", "list", "--porcelain", "-z"),
        isNulSeparated: true,
      };
    } catch {
      return {
        output: git("worktree", "list", "--porcelain"),
        isNulSeparated: false,
      };
    }
  })();
  const parsed = parseWorktreeListPorcelain(wtList.output, {
    isNulSeparated: wtList.isNulSeparated,
  });

  if (parsed.worktrees.length === 0 || !parsed.mainPath) {
    exitWithMessage("Unable to determine main worktree from git worktree list");
  }

  const mainPath = normalizeGitPath(parsed.mainPath);

  const normalizedWorktrees: WorktreeEntry[] = parsed.worktrees
    .slice(1)
    .map((worktree) => ({
      ...worktree,
      path: normalizeGitPath(worktree.path),
    }));

  return { mainPath, worktrees: normalizedWorktrees };
}
