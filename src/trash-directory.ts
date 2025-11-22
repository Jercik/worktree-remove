/**
 * Move a directory to the system trash
 */

import trash from "trash";

export async function trashDirectory(directoryPath: string): Promise<boolean> {
  try {
    await trash([directoryPath], { glob: false });
    return true;
  } catch (error) {
    console.warn(
      `⚠️  Failed to move directory '${directoryPath}' to trash:`,
      error,
    );
    return false;
  }
}
