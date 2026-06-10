import path from "node:path";

export function normalizeGitPath(
  gitPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== "win32") {
    return gitPath;
  }

  const trimmed = gitPath.trim();

  // Match Cygwin (/cygdrive/c/...) and MSYS (/c/...) drive paths
  const match = /^(?:\/cygdrive)?\/(?<drive>[a-zA-Z])(?:\/(?<rest>.*))?$/u.exec(trimmed);
  if (match) {
    const driveLetter = match.groups?.drive;
    if (driveLetter === undefined) {
      return trimmed;
    }
    const rest = match.groups?.rest ?? "";
    const restNative = rest.replaceAll(path.posix.sep, path.win32.sep);
    return `${driveLetter.toUpperCase()}:\\${restNative}`;
  }

  return trimmed;
}
