/**
 * Move a directory to the system trash
 */

import trash from "trash";

export type TrashResult = { ok: true } | { ok: false; reason: string };

export async function trashDirectory(
  directoryPath: string,
): Promise<TrashResult> {
  try {
    await trash([directoryPath], { glob: false });
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  }
}
