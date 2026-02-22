import { exitWithMessage } from "../git/git-helpers.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";
import { isPathStrictlyWithin } from "./is-path-equal-or-within.js";

type RemovalSafetyInput = {
  targetPath: string;
  mainPath: string;
  registeredPath: string | undefined;
};

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
    exitWithMessage(
      "Refusing to remove a directory containing the main worktree.",
    );
  }

  if (
    !input.registeredPath &&
    isPathStrictlyWithin({
      basePath: input.mainPath,
      candidatePath: input.targetPath,
      platform: process.platform,
    })
  ) {
    exitWithMessage(
      "Refusing to remove an unregistered directory inside the main worktree.",
    );
  }
}
