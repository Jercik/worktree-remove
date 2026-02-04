/**
 * Get worktree information from git
 */

import { git, exitWithMessage } from "./git-helpers.js";
import { parseWorktreeListPorcelain } from "./parse-worktree-list.js";
import type { WorktreeEntry } from "./parse-worktree-list.js";

interface WorktreeInfo {
  mainPath: string;
  worktrees: WorktreeEntry[]; // excludes main
}

export function getWorktreeInfo(): WorktreeInfo {
  const wtList = git("worktree", "list", "--porcelain");
  const parsed = parseWorktreeListPorcelain(wtList);

  if (parsed.worktrees.length === 0 || !parsed.mainPath) {
    exitWithMessage("Unable to determine main worktree from git worktree list");
  }

  return { mainPath: parsed.mainPath, worktrees: parsed.worktrees.slice(1) };
}
