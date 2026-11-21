import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { exitWithMessage } from "../git/git-helpers.js";
import { directoryExists } from "../fs/check-directory-exists.js";
import { isLinkedWorktreeOf } from "../git/is-linked-worktree-of.js";
import { findWorktreeByPath } from "./find-worktree-by-path.js";
import { resolveWorktreeTarget } from "./resolve-worktree-target.js";
import type { WorktreeEntry } from "../git/worktree-entry.js";

interface ResolveRemovalTargetInput {
  input: string;
  cwd: string;
  mainPath: string;
  commonDir: string;
  worktrees: WorktreeEntry[];
  platform: NodeJS.Platform;
}

interface ResolveRemovalTargetResult {
  targetPath: string;
  registeredPath: string | undefined;
  registeredWorktree: WorktreeEntry | undefined;
  isPathInputTarget: boolean;
}

// Git records worktree paths with symlinks resolved and, on case-insensitive file
// systems, in their on-disk case, so a target is matched in the same form. A symlink
// named as the target stays the target, so removal never reaches what it points to.
async function resolveRealEntryPath(
  entryPath: string,
  pathApi: typeof path.posix,
): Promise<string> {
  const entry = await lstat(entryPath);
  if (entry.isSymbolicLink()) {
    return pathApi.join(await realpath(pathApi.dirname(entryPath)), pathApi.basename(entryPath));
  }
  return realpath(entryPath);
}

export async function resolveRemovalTarget(
  input: ResolveRemovalTargetInput,
): Promise<ResolveRemovalTargetResult> {
  const pathApi = input.platform === "win32" ? path.win32 : path.posix;
  const resolvedTarget = resolveWorktreeTarget(input);

  if (resolvedTarget.kind === "ambiguous") {
    exitWithMessage(resolvedTarget.message);
  }

  const isPathInputTarget = resolvedTarget.isPathInput;

  let registeredWorktree: WorktreeEntry | undefined;
  let targetPath: string;

  if (resolvedTarget.kind === "registered") {
    registeredWorktree = resolvedTarget.worktree;
    targetPath = resolvedTarget.worktree.path;
  } else {
    let existingPath: string | undefined;
    let secondExistingPath: string | undefined;

    for (const candidatePath of resolvedTarget.candidatePaths) {
      if (!(await directoryExists(candidatePath))) {
        continue;
      }
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

    targetPath = await resolveRealEntryPath(existingPath, pathApi);
    registeredWorktree = findWorktreeByPath(input.worktrees, targetPath, input.platform);

    if (
      !registeredWorktree &&
      !resolvedTarget.isPathInput &&
      !(await isLinkedWorktreeOf(targetPath, input.commonDir))
    ) {
      exitWithMessage(
        `'${existingPath}' matches '${resolvedTarget.input}' but is not a worktree of this repository. Pass its path to remove it anyway.`,
      );
    }
  }

  const resolvedTargetPath = pathApi.resolve(targetPath);
  if (pathApi.parse(resolvedTargetPath).root === resolvedTargetPath) {
    exitWithMessage("Refusing to remove a filesystem root directory.");
  }

  return {
    targetPath: resolvedTargetPath,
    registeredPath: registeredWorktree?.path,
    registeredWorktree,
    isPathInputTarget,
  };
}
