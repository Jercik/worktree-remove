import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { normalizePathKey } from "../fs/normalize-path-key.js";

async function readGitFile(directory: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(directory, ".git"), "utf8");
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === "ENOENT" || code === "EISDIR") {
      return undefined;
    }
    throw error;
  }
}

async function realpathIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await realpath(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

// A linked worktree's `.git` file names its entry under `<common dir>/worktrees/`.
// The file outlives the entry when Git prunes it, so it still identifies the
// repository a leftover directory came from.
export async function isLinkedWorktreeOf(directory: string, commonDir: string): Promise<boolean> {
  const gitFile = await readGitFile(directory);
  const gitDirectory = gitFile
    ? /^gitdir: (?<path>.+)$/mu.exec(gitFile)?.groups?.path?.trim()
    : undefined;
  if (!gitDirectory) {
    return false;
  }

  const worktreesDirectory = path.dirname(path.resolve(directory, gitDirectory));
  if (path.basename(worktreesDirectory) !== "worktrees") {
    return false;
  }

  const owningCommonDir = await realpathIfExists(path.dirname(worktreesDirectory));
  return (
    owningCommonDir !== undefined &&
    normalizePathKey(owningCommonDir) === normalizePathKey(await realpath(commonDir))
  );
}
