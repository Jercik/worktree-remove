import path from "node:path";
import { exitWithMessage } from "../git/git-helpers.js";
import { directoryExists } from "../fs/check-directory-exists.js";
import { resolveWorktreeTarget } from "./resolve-worktree-target.js";
import type { WorktreeEntry } from "../git/parse-worktree-list.js";

export type ResolveRemovalTargetInput = {
  input: string;
  cwd: string;
  mainPath: string;
  worktrees: WorktreeEntry[];
  platform: NodeJS.Platform;
};

export type ResolveRemovalTargetResult = {
  targetPath: string;
  registeredPath: string | undefined;
  registeredWorktree: WorktreeEntry | undefined;
  isPathInputTarget: boolean;
};

export async function resolveRemovalTarget(
  input: ResolveRemovalTargetInput,
): Promise<ResolveRemovalTargetResult> {
  const pathApi = input.platform === "win32" ? path.win32 : path.posix;
  const resolvedTarget = resolveWorktreeTarget(input);

  if (resolvedTarget.kind === "ambiguous") {
    exitWithMessage(resolvedTarget.message);
  }

  const isPathInputTarget = resolvedTarget.isPathInput;

  let registeredPath: string | undefined;
  const registeredWorktree =
    resolvedTarget.kind === "registered" ? resolvedTarget.worktree : undefined;
  let targetPath: string;

  if (resolvedTarget.kind === "registered") {
    registeredPath = resolvedTarget.worktree.path;
    targetPath = resolvedTarget.worktree.path;
  } else {
    let existingPath: string | undefined;
    let secondExistingPath: string | undefined;

    for (const candidatePath of resolvedTarget.candidatePaths) {
      if (!(await directoryExists(candidatePath))) continue;
      if (!existingPath) {
        existingPath = candidatePath;
        continue;
      }

      secondExistingPath = candidatePath;
      break;
    }

    if (!existingPath) {
      exitWithMessage(
        resolvedTarget.isPathInput
          ? `No worktree or directory found at '${resolvedTarget.resolvedInputPath}'.`
          : `No worktree or directory found for '${resolvedTarget.input}'.`,
      );
    }

    if (secondExistingPath) {
      exitWithMessage(
        `Multiple directories exist for '${resolvedTarget.input}': '${existingPath}' and '${secondExistingPath}'. Re-run with --interactive or pass a full path.`,
      );
    }

    targetPath = existingPath;
  }

  const resolvedTargetPath = pathApi.resolve(targetPath);
  if (pathApi.parse(resolvedTargetPath).root === resolvedTargetPath) {
    exitWithMessage("Refusing to remove a filesystem root directory.");
  }

  return {
    targetPath: resolvedTargetPath,
    registeredPath,
    registeredWorktree,
    isPathInputTarget,
  };
}
