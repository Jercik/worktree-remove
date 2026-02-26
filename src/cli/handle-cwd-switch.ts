/**
 * Detect and handle the case where the process cwd is inside a target
 * directory that is about to be removed.
 */

import type { OutputWriter } from "./output-writer.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";
import { exitWithMessage } from "../git/git-helpers.js";
import { isPathEqualOrWithin } from "../worktree/is-path-equal-or-within.js";

type CwdSwitchInput = {
  targetPaths: string[];
  invocationCwd: string;
  mainPath: string;
  /** Display name shown in the pre-confirmation warning. */
  targetName: string;
  dryRun: boolean;
  output: OutputWriter;
};

/**
 * Warn about cwd being inside a target (shown before the confirmation prompt),
 * and return a callback to perform the actual switch (called after confirmation).
 *
 * Returns `undefined` if no switch is needed.
 */
export function prepareCwdSwitch(
  input: CwdSwitchInput,
): (() => void) | undefined {
  const { targetPaths, invocationCwd, mainPath, targetName, dryRun, output } =
    input;

  const cwdInsideAnyTarget = targetPaths.some((targetPath) =>
    isPathEqualOrWithin({
      basePath: targetPath,
      candidatePath: invocationCwd,
      platform: process.platform,
    }),
  );

  if (
    !cwdInsideAnyTarget ||
    normalizePathKey(invocationCwd) === normalizePathKey(mainPath)
  ) {
    return undefined;
  }

  const switchVerb = dryRun ? "would" : "will";
  output.warn(
    `Current directory is inside '${targetName}'. The command ${switchVerb} switch to '${mainPath}' before removing it, and your shell directory will not change.`,
  );

  return () => {
    if (dryRun) {
      output.info(
        `Would switch process working directory to '${mainPath}' before removal.`,
      );
      output.warn(
        `Dry run only. In a real run, your shell may still point to the removed directory. Switch it to '${mainPath}' or another existing path.`,
      );
    } else {
      try {
        process.chdir(mainPath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        exitWithMessage(
          `Could not switch working directory to main worktree '${mainPath}': ${reason}`,
        );
      }
      output.info(
        `Switched process working directory to '${mainPath}' before removal.`,
      );
      output.warn(
        `After removal, your shell may still point to a removed directory. Switch it to '${mainPath}' or another existing path.`,
      );
    }
  };
}
