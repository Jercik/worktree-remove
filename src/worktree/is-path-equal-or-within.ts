import path from "node:path";

export type PathContainmentInput = {
  basePath: string;
  candidatePath: string;
  platform: NodeJS.Platform;
};

export function isPathEqualOrWithin(input: PathContainmentInput): boolean {
  const pathApi = input.platform === "win32" ? path.win32 : path.posix;
  const relative = pathApi.relative(
    pathApi.resolve(input.basePath),
    pathApi.resolve(input.candidatePath),
  );

  if (relative === "") return true;
  if (pathApi.isAbsolute(relative)) return false;
  if (relative === ".." || relative.startsWith(`..${pathApi.sep}`))
    return false;
  return true;
}
