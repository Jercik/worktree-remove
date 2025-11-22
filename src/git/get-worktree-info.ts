/**
 * Get worktree information from git
 */

import { git, exitWithMessage, normalizeBranchName } from "./git-helpers.js";

interface WorktreeInfo {
  mainPath: string;
  worktrees: Map<string, string>; // branch -> path
}

export function getWorktreeInfo(): WorktreeInfo {
  const wtList = git("worktree", "list", "--porcelain");
  const wtLines = wtList.split(/\n/u);

  let mainPath = "";
  const worktrees = new Map<string, string>();
  let currentPath = "";

  for (const line of wtLines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.replace(/^worktree\s+/u, "").trim();
      if (!mainPath) mainPath = currentPath; // First worktree is the main one
    } else if (line.startsWith("branch ") && currentPath) {
      const branch = normalizeBranchName(
        line.replace(/^branch\s+/u, "").trim(),
      );
      if (currentPath !== mainPath) {
        worktrees.set(branch, currentPath);
      }
    }
  }

  if (!mainPath) {
    exitWithMessage("Unable to determine main worktree from git worktree list");
  }

  return { mainPath, worktrees };
}
