import path from "node:path";
import { exitWithMessage } from "../git/git-helpers.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";

export type RemovalSafetyInput = {
  targetPath: string;
  mainPath: string;
  registeredPath: string | undefined;
};

export function assertRemovalSafe(input: RemovalSafetyInput): void {
  if (normalizePathKey(input.targetPath) === normalizePathKey(input.mainPath)) {
    exitWithMessage("Refusing to remove the main worktree.");
  }

  const relativeMainToTarget = path.relative(
    path.resolve(input.targetPath),
    path.resolve(input.mainPath),
  );
  const targetContainsMain =
    relativeMainToTarget !== "" &&
    !path.isAbsolute(relativeMainToTarget) &&
    relativeMainToTarget !== ".." &&
    !relativeMainToTarget.startsWith(`..${path.sep}`);

  if (targetContainsMain) {
    exitWithMessage(
      "Refusing to remove a directory containing the main worktree.",
    );
  }

  const relativeTargetToMain = path.relative(
    path.resolve(input.mainPath),
    path.resolve(input.targetPath),
  );
  const mainContainsTarget =
    relativeTargetToMain !== "" &&
    !path.isAbsolute(relativeTargetToMain) &&
    relativeTargetToMain !== ".." &&
    !relativeTargetToMain.startsWith(`..${path.sep}`);

  if (!input.registeredPath && mainContainsTarget) {
    exitWithMessage(
      "Refusing to remove an unregistered directory inside the main worktree.",
    );
  }
}
