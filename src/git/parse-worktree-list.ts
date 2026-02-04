import { normalizeBranchName } from "./git-helpers.js";

export type WorktreeEntry = {
  path: string;
  head: string | undefined;
  branch: string | undefined;
  isDetached: boolean;
};

export type ParsedWorktreeList = {
  mainPath: string;
  worktrees: WorktreeEntry[];
};

export function parseWorktreeListPorcelain(output: string): ParsedWorktreeList {
  const lines = output.split(/\0|\n/u);

  const worktrees: WorktreeEntry[] = [];
  let current: WorktreeEntry | undefined;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (current) {
        worktrees.push(current);
      }

      const worktreePath = line.replace(/^worktree\s+/u, "").trim();
      current = {
        path: worktreePath,
        head: undefined,
        branch: undefined,
        isDetached: false,
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith("HEAD ")) {
      const head = line.replace(/^HEAD\s+/u, "").trim();
      current.head = head || undefined;
      continue;
    }

    if (line.startsWith("branch ")) {
      const rawBranch = line.replace(/^branch\s+/u, "").trim();
      current.branch = rawBranch ? normalizeBranchName(rawBranch) : undefined;
      continue;
    }

    if (line.trim() === "detached") {
      current.isDetached = true;
      current.branch = undefined;
      continue;
    }
  }

  if (current) {
    worktrees.push(current);
  }

  return { mainPath: worktrees[0]?.path ?? "", worktrees };
}
