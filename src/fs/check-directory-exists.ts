/**
 * Check if a directory exists
 */

import * as fs from "node:fs/promises";

export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
