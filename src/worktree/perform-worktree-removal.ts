import { confirmAction } from "../cli/confirm-action.js";
import type { OutputWriter } from "../cli/output-writer.js";
import { unregisterWorktree } from "../git/unregister-worktree.js";
import { directoryExists } from "../fs/check-directory-exists.js";
import { trashDirectory } from "../fs/trash-directory.js";

export type PerformWorktreeRemovalInput = {
  status: string;
  targetDirectoryName: string;
  targetPath: string;
  mainPath: string;
  registeredPath: string | undefined;
  directoryExistedInitially: boolean;
  dryRun: boolean;
  assumeYes: boolean;
  force: boolean;
  allowPrompt: boolean;
  output: OutputWriter;
};

export async function performWorktreeRemoval(
  parameters: PerformWorktreeRemovalInput,
): Promise<void> {
  parameters.output.info(
    `Removing ${parameters.status} '${parameters.targetDirectoryName}'...`,
  );

  const directoryExistsBefore = await directoryExists(parameters.targetPath);
  let movedToTrash = false;
  let forceUnregister = parameters.force;

  if (directoryExistsBefore) {
    if (parameters.dryRun) {
      parameters.output.info(`Would move '${parameters.targetPath}' to trash.`);
    } else {
      parameters.output.info("Moving directory to trash...");
      const trashResult = await trashDirectory(parameters.targetPath);
      if (trashResult.ok) {
        movedToTrash = true;
        parameters.output.info("Directory moved to trash.");
      } else if (parameters.registeredPath) {
        const proceed = parameters.force
          ? true
          : await confirmAction(
              `Could not move directory '${parameters.targetDirectoryName}' to trash: ${trashResult.reason}. Proceed with unregistering anyway? (Git may permanently delete it)`,
              {
                allowPrompt: parameters.allowPrompt,
                assumeYes: parameters.assumeYes,
                dryRun: parameters.dryRun,
                promptDisabledMessage:
                  "Trash move failed. Re-run with --yes or --force to proceed in non-interactive mode.",
              },
            );
        if (!proceed) {
          parameters.output.warn("Removal cancelled.");
          return;
        }
        // User confirmed git may permanently delete the directory, so force
        // the unregister to handle dirty worktrees.
        forceUnregister = true;
        if (parameters.force || parameters.assumeYes) {
          parameters.output.warn(
            `Could not move directory to trash: ${trashResult.reason}. Git may permanently delete it.`,
          );
        }
      } else {
        parameters.output.warn(
          `Could not move directory to trash: ${trashResult.reason}. Remove manually.`,
        );
        return;
      }
    }
  }

  if (parameters.registeredPath) {
    if (parameters.dryRun) {
      parameters.output.info(
        `Would unregister '${parameters.registeredPath}' from Git.`,
      );
    } else {
      parameters.output.info("Unregistering from Git...");
      const unregisterResult = unregisterWorktree(
        parameters.mainPath,
        parameters.registeredPath,
        { force: forceUnregister },
      );
      if (unregisterResult.ok) {
        parameters.output.info("Unregistered from Git.");
      } else {
        parameters.output.warn(
          `Could not fully unregister from Git: ${unregisterResult.reason}.`,
        );
      }

      if (directoryExistsBefore && !movedToTrash) {
        const directoryExistsAfter = await directoryExists(
          parameters.targetPath,
        );
        if (directoryExistsAfter) {
          parameters.output.warn("Directory still exists. Remove it manually.");
        } else {
          parameters.output.info("Directory was removed by Git.");
        }
      }
    }
  } else if (!directoryExistsBefore && !parameters.directoryExistedInitially) {
    // Only report when the directory never existed; it may disappear between checks.
    parameters.output.info("Directory did not exist.");
  }

  parameters.output.info("Done.");
}
