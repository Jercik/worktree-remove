import path from "node:path";

export function normalizePathKey(
  filePath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === "win32") {
    return path.win32.resolve(filePath).toLowerCase();
  }

  return path.resolve(filePath);
}
