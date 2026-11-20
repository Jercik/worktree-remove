import { exitWithMessage } from "../git/git-helpers.js";
import type { WorktreeEntry } from "../git/worktree-entry.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";
import { isPathStrictlyWithin } from "./is-path-strictly-within.js";

interface RemovalSafetyInput {
  targetPath: string;
  mainPath: string;
  registeredWorktree: WorktreeEntry | undefined;
}

export function assertRemovalSafe(input: RemovalSafetyInput): void {
  if (normalizePathKey(input.targetPath) === normalizePathKey(input.mainPath)) {
    exitWithMessage("Refusing to remove the main worktree.");
  }

  if (
    isPathStrictlyWithin({
      basePath: input.targetPath,
      candidatePath: input.mainPath,
      platform: process.platform,
    })
  ) {
    exitWithMessage("Refusing to remove a directory containing the main worktree.");
  }

  if (
    !input.registeredWorktree &&
    isPathStrictlyWithin({
      basePath: input.mainPath,
      candidatePath: input.targetPath,
      platform: process.platform,
    })
  ) {
    exitWithMessage("Refusing to remove an unregistered directory inside the main worktree.");
  }

  const { registeredWorktree } = input;
  if (registeredWorktree?.lock) {
    const { reason } = registeredWorktree.lock;
    const reasonSuffix = reason ? ` (reason: ${reason})` : "";
    exitWithMessage(
      `Refusing to remove locked worktree '${registeredWorktree.path}'${reasonSuffix}. Unlock it with 'git worktree unlock' first.`,
    );
  }
}
