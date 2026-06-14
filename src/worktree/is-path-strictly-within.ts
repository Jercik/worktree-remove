import path from "node:path";

interface PathContainmentInput {
  basePath: string;
  candidatePath: string;
  platform: NodeJS.Platform;
}

export function isPathStrictlyWithin(input: PathContainmentInput): boolean {
  const pathApi = input.platform === "win32" ? path.win32 : path.posix;
  if (!pathApi.isAbsolute(input.basePath)) {
    return false;
  }
  if (!pathApi.isAbsolute(input.candidatePath)) {
    return false;
  }

  const relative = pathApi.relative(
    pathApi.resolve(input.basePath),
    pathApi.resolve(input.candidatePath),
  );

  if (relative === "") {
    return false;
  }
  if (pathApi.isAbsolute(relative)) {
    return false;
  }
  if (relative === ".." || relative.startsWith(`..${pathApi.sep}`)) {
    return false;
  }
  return true;
}
