import { normalizePathKey } from "../fs/normalize-path-key.js";
import type { WorktreeEntry } from "../git/worktree-entry.js";

export function findWorktreeByPath(
  worktrees: readonly WorktreeEntry[],
  worktreePath: string,
  platform: NodeJS.Platform,
): WorktreeEntry | undefined {
  const pathKey = normalizePathKey(worktreePath, platform);
  return worktrees.find((worktree) => normalizePathKey(worktree.path, platform) === pathKey);
}
