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
  const {
    status,
    targetDirectoryName,
    targetPath,
    mainPath,
    registeredPath,
    directoryExistedInitially,
    dryRun,
    assumeYes,
    force,
    allowPrompt,
    output,
  } = parameters;

  output.info(`Removing ${status} '${targetDirectoryName}'...`);

  const directoryExistsBefore = await directoryExists(targetPath);
  let movedToTrash = false;
  let forceUnregister = force;

  if (directoryExistsBefore) {
    if (dryRun) {
      output.info(`Would move '${targetPath}' to trash.`);
    } else {
      output.info("Moving directory to trash...");
      const trashResult = await trashDirectory(targetPath);
      if (trashResult.ok) {
        movedToTrash = true;
        output.info("Directory moved to trash.");
      } else if (registeredPath) {
        const proceed = force
          ? true
          : await confirmAction(
              `Could not move directory '${targetDirectoryName}' to trash: ${trashResult.reason}. Proceed with unregistering anyway? (Git may permanently delete it)`,
              {
                allowPrompt,
                assumeYes,
                dryRun,
                promptDisabledMessage:
                  "Trash move failed. Re-run with --yes or --force to proceed in non-interactive mode.",
              },
            );
        if (!proceed) {
          output.warn("Removal cancelled.");
          return;
        }
        // User confirmed git may permanently delete the directory, so force
        // the unregister to handle dirty worktrees.
        forceUnregister = true;
        if (force || assumeYes) {
          output.warn(
            `Could not move directory to trash: ${trashResult.reason}. Git may permanently delete it.`,
          );
        }
      } else {
        output.error(
          `Could not move directory to trash: ${trashResult.reason}. Remove manually.`,
        );
        return;
      }
    }
  }

  if (registeredPath) {
    if (dryRun) {
      output.info(`Would unregister '${registeredPath}' from Git.`);
    } else {
      output.info("Unregistering from Git...");
      const unregisterResult = unregisterWorktree(mainPath, registeredPath, {
        force: forceUnregister,
      });
      if (unregisterResult.ok) {
        output.info("Unregistered from Git.");
      } else {
        output.error(
          `Could not fully unregister from Git: ${unregisterResult.reason}.`,
        );
      }

      if (directoryExistsBefore && !movedToTrash) {
        const directoryExistsAfter = await directoryExists(targetPath);
        if (directoryExistsAfter) {
          output.error("Directory still exists. Remove it manually.");
        } else {
          output.info("Directory was removed by Git.");
        }
      }
    }
  } else if (!directoryExistsBefore && !directoryExistedInitially) {
    // Only report when the directory never existed; it may disappear between checks.
    output.info("Directory did not exist.");
  }

  output.info("Done.");
}
