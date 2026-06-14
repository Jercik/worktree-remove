import path from "node:path";
import { normalizePathKey } from "../fs/normalize-path-key.js";
import { isPathStrictlyWithin } from "./is-path-strictly-within.js";

interface PathContainmentInput {
  basePath: string;
  candidatePath: string;
  platform: NodeJS.Platform;
}

export function isPathEqualOrWithin(input: PathContainmentInput): boolean {
  const pathApi = input.platform === "win32" ? path.win32 : path.posix;
  // Require absolute inputs so the equality branch upholds the same contract as isPathStrictlyWithin.
  if (!pathApi.isAbsolute(input.basePath) || !pathApi.isAbsolute(input.candidatePath)) {
    return false;
  }
  return (
    normalizePathKey(input.basePath, input.platform) ===
      normalizePathKey(input.candidatePath, input.platform) || isPathStrictlyWithin(input)
  );
}
