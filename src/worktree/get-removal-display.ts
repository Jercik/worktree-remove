import path from "node:path";

type WorktreeEntry = {
  path: string;
  head: string | undefined;
  branch: string | undefined;
  isDetached: boolean;
};

type RemovalDisplayInput = {
  cwd: string;
  targetPath: string;
  registeredPath: string | undefined;
  registeredWorktree: WorktreeEntry | undefined;
  isPathInputTarget: boolean;
};

type RemovalDisplayInfo = {
  status: string;
  referenceInfo: string;
  displayPath: string;
  targetDirectoryName: string;
};

export function getRemovalDisplayInfo(
  input: RemovalDisplayInput,
): RemovalDisplayInfo {
  let status: string;
  if (input.registeredPath) {
    status = "registered worktree";
  } else if (input.isPathInputTarget) {
    status = "unregistered directory";
  } else {
    status = "orphaned directory";
  }

  const referenceInfo = (() => {
    if (!input.registeredWorktree || !input.registeredPath) return "";
    if (input.registeredWorktree.branch) {
      return `branch ${input.registeredWorktree.branch}`;
    }
    const head = input.registeredWorktree.head?.slice(0, 7);
    return head ? `detached HEAD @ ${head}` : "detached HEAD";
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
