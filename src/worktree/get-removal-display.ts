import path from "node:path";
import type { WorktreeEntry } from "../git/parse-worktree-list.js";

export type RemovalDisplayInput = {
  cwd: string;
  targetPath: string;
  registeredPath: string | undefined;
  registeredWorktree: WorktreeEntry | undefined;
  isPathInputTarget: boolean;
};

export type RemovalDisplayInfo = {
  status: string;
  referenceInfo: string;
  displayPath: string;
  targetDirectoryName: string;
};

export function getRemovalDisplayInfo(
  input: RemovalDisplayInput,
): RemovalDisplayInfo {
  const status = input.registeredPath
    ? "registered worktree"
    : input.isPathInputTarget
      ? "unregistered directory"
      : "orphaned directory";

  const referenceInfo = (() => {
    if (!input.registeredWorktree || !input.registeredPath) return "";
    if (input.registeredWorktree.branch)
      return ` (branch ${input.registeredWorktree.branch})`;
    const head = input.registeredWorktree.head?.slice(0, 7);
    return head ? ` (detached HEAD @ ${head})` : " (detached HEAD)";
  })();

  const displayPath = input.isPathInputTarget
    ? input.targetPath
    : path.relative(input.cwd, input.targetPath) || input.targetPath;

  return {
    status,
    referenceInfo,
    displayPath,
    targetDirectoryName: path.basename(input.targetPath),
  };
}
