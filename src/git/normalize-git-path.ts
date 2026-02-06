import path from "node:path";

export function normalizeGitPath(
  gitPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== "win32") return gitPath;

  const trimmed = gitPath.trim();

  // Match Cygwin (/cygdrive/c/...) and MSYS (/c/...) drive paths
  const match = /^(?:\/cygdrive)?\/([a-zA-Z])(?:\/(.*))?$/u.exec(trimmed);
  if (match) {
    const driveLetter = match[1] as string;
    const rest = match[2] ?? "";
    const restNative = rest.replaceAll(path.posix.sep, path.win32.sep);
    return `${driveLetter.toUpperCase()}:\\${restNative}`;
  }

  return trimmed;
}
