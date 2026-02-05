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

export type ParseWorktreeListOptions = {
  isNulSeparated?: boolean;
};

export function parseWorktreeListPorcelain(
  output: string,
  options: ParseWorktreeListOptions = {},
): ParsedWorktreeList {
  const isNulSeparated = options.isNulSeparated ?? output.includes("\0");
  const lines = isNulSeparated ? output.split("\0") : output.split(/\n/u);

  const worktrees: WorktreeEntry[] = [];
  let current: WorktreeEntry | undefined;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (current) {
        worktrees.push(current);
      }

      const worktreePathRaw = line.slice("worktree ".length);
      const worktreePath = isNulSeparated
        ? worktreePathRaw
        : worktreePathRaw.trim();
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
      const headRaw = line.slice("HEAD ".length);
      const head = isNulSeparated ? headRaw : headRaw.trim();
      current.head = head || undefined;
      continue;
    }

    if (line.startsWith("branch ")) {
      const rawBranchRaw = line.slice("branch ".length);
      const rawBranch = isNulSeparated ? rawBranchRaw : rawBranchRaw.trim();
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
