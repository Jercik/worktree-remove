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

  // Step 1: Unregister from Git first (let Git delete the directory if it wants)
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
  }

  // Step 2: If directory still exists, move it to trash
  // Re-check existence since git worktree remove may have deleted it
  const directoryExistsNow = await directoryExists(parameters.targetPath);

  if (!directoryExistsNow && parameters.directoryExistedInitially) {
    // Directory was deleted by git worktree remove
    console.log("  ✓ Directory was removed by Git");
  } else if (directoryExistsNow) {
    // Directory still exists, offer to trash it
    const trashConfirmed = parameters.registeredPath
      ? await confirm(
          `Move directory '${parameters.targetDirectoryName}' to trash?`,
        )
      : true; // Always trash orphaned directories if user confirmed above

    if (trashConfirmed) {
      console.log("  • Moving directory to trash...");
      const movedToTrash = await trashDirectory(parameters.targetPath);
      if (movedToTrash) {
        console.log("  ✓ Directory moved to trash");
      } else {
        console.log(
          "  ⚠️  Could not move directory to trash - remove manually",
        );
      }
    } else {
      console.log("  • Directory retained");
    }
  } else {
    // Directory never existed
    console.log("  ℹ Directory did not exist");
  }

  console.log("✔ Done!");
}
