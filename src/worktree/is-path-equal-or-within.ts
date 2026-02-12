import path from "node:path";

export type PathContainmentInput = {
  basePath: string;
  candidatePath: string;
  platform: NodeJS.Platform;
};

function isPathWithin(
  input: PathContainmentInput,
  includeEqual: boolean,
): boolean {
  const pathApi = input.platform === "win32" ? path.win32 : path.posix;
  // This helper is designed for already-resolved absolute paths.
  // Forcing absolute inputs avoids host/target path-API mismatches such as
  // `path.win32.resolve` behavior on POSIX hosts for relative values.
  if (!pathApi.isAbsolute(input.basePath)) return false;
  if (!pathApi.isAbsolute(input.candidatePath)) return false;

  const relative = pathApi.relative(
    pathApi.resolve(input.basePath),
    pathApi.resolve(input.candidatePath),
  );

  if (relative === "") return includeEqual;
  if (pathApi.isAbsolute(relative)) return false;
  if (relative === ".." || relative.startsWith(`..${pathApi.sep}`))
    return false;
  return true;
}

export function isPathEqualOrWithin(input: PathContainmentInput): boolean {
  return isPathWithin(input, true);
}

export function isPathStrictlyWithin(input: PathContainmentInput): boolean {
  return isPathWithin(input, false);
}
