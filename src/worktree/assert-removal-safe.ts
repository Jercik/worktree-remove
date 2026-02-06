import path from "node:path";
import { exitWithMessage } from "../git/git-helpers.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";

export type RemovalSafetyInput = {
  targetPath: string;
  mainPath: string;
  registeredPath: string | undefined;
};

/**
 * Returns true when `target` is strictly inside `base` (not equal, not
 * outside, not on a different drive).  Uses {@link path.relative} for
 * cross-platform correctness — see the Cross-Platform Path Validation rule.
 */
function isWithinDirectory(base: string, target: string): boolean {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (relative === "") return false;
  if (path.isAbsolute(relative)) return false;
  return relative !== ".." && !relative.startsWith(`..${path.sep}`);
}

export function assertRemovalSafe(input: RemovalSafetyInput): void {
  if (normalizePathKey(input.targetPath) === normalizePathKey(input.mainPath)) {
    exitWithMessage("Refusing to remove the main worktree.");
  }

  if (isWithinDirectory(input.targetPath, input.mainPath)) {
    exitWithMessage(
      "Refusing to remove a directory containing the main worktree.",
    );
  }

  if (
    !input.registeredPath &&
    isWithinDirectory(input.mainPath, input.targetPath)
  ) {
    exitWithMessage(
      "Refusing to remove an unregistered directory inside the main worktree.",
    );
  }
}
