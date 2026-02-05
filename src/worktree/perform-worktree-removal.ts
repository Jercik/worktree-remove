import { confirm } from "../git/git-helpers.js";
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
};

export async function performWorktreeRemoval(
  parameters: PerformWorktreeRemovalInput,
): Promise<void> {
  console.log(
    `➤ Removing ${parameters.status} '${parameters.targetDirectoryName}'...`,
  );

  const directoryExistsBefore = await directoryExists(parameters.targetPath);
  let movedToTrash = false;

  if (directoryExistsBefore) {
    console.log("  • Moving directory to trash...");
    movedToTrash = await trashDirectory(parameters.targetPath);
    if (movedToTrash) {
      console.log("  ✓ Directory moved to trash");
    } else if (parameters.registeredPath) {
      const proceed = await confirm(
        `Could not move directory '${parameters.targetDirectoryName}' to trash. Proceed with unregistering anyway? (Git may permanently delete it)`,
      );
      if (!proceed) {
        console.log("Removal cancelled.");
        return;
      }
    } else {
      console.log("  ⚠️  Could not move directory to trash - remove manually");
    }
  }

  if (parameters.registeredPath) {
    console.log("  • Unregistering from Git...");
    const unregistered = unregisterWorktree(
      parameters.mainPath,
      parameters.registeredPath,
    );
    if (unregistered) {
      console.log("  ✓ Unregistered from Git");
    } else {
      console.log(
        "  ⚠️  Could not fully unregister from Git (may be partially removed)",
      );
    }

    if (directoryExistsBefore && !movedToTrash) {
      const directoryExistsAfter = await directoryExists(parameters.targetPath);
      if (directoryExistsAfter) {
        console.log("  ⚠️  Directory still exists - remove manually");
      } else {
        console.log("  ✓ Directory was removed by Git");
      }
    }
  } else if (!directoryExistsBefore && !parameters.directoryExistedInitially) {
    console.log("  ℹ Directory did not exist");
  }

  console.log("✔ Done!");
}
