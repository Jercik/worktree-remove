/**
 * Check if a worktree has uncommitted changes
 */

import { git } from "./git-helpers.js";

export function hasUncommittedChanges(worktreePath: string): boolean {
  try {
    const status = git("-C", worktreePath, "status", "--porcelain");
    return status !== "";
  } catch {
    // If git status fails, the directory might not be a valid git repo
    return false;
  }
}
