/**
 * Get list of worktree branches for interactive selection
 */

import { git, normalizeBranchName } from "./git-helpers.js";

export function getWorktreeBranches(): string[] {
  const wtList = git("worktree", "list", "--porcelain");
  const wtLines = wtList.split(/\n/u);

  const branches: string[] = [];
  let mainPath = "";
  let currentPath = "";

  for (const line of wtLines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.replace(/^worktree\s+/u, "").trim();
      if (!mainPath) mainPath = currentPath; // First worktree is the main one
    } else if (line.startsWith("branch ") && currentPath) {
      const branch = normalizeBranchName(
        line.replace(/^branch\s+/u, "").trim(),
      );
      // Only include branches from non-main worktrees
      if (branch && currentPath !== mainPath) {
        branches.push(branch);
      }
    }
  }

  return branches;
}
