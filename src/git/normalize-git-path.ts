import path from "node:path";

export function normalizeGitPath(
  gitPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== "win32") return gitPath;

  const trimmed = gitPath.trim();

  const cygwinMatch = /^\/cygdrive\/([a-zA-Z])(?:\/(.*))?$/u.exec(trimmed);
  if (cygwinMatch) {
    const driveLetter = cygwinMatch[1];
    if (!driveLetter) return trimmed;

    const rest = cygwinMatch[2] ?? "";
    const restNative = rest.replaceAll(path.posix.sep, path.win32.sep);
    return `${driveLetter.toUpperCase()}:\\${restNative}`;
  }

  const msysMatch = /^\/([a-zA-Z])(?:\/(.*))?$/u.exec(trimmed);
  if (msysMatch) {
    const driveLetter = msysMatch[1];
    if (!driveLetter) return trimmed;

    const rest = msysMatch[2] ?? "";
    const restNative = rest.replaceAll(path.posix.sep, path.win32.sep);
    return `${driveLetter.toUpperCase()}:\\${restNative}`;
  }

  return trimmed;
}
