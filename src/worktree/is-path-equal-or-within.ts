import { normalizePathKey } from "../fs/normalize-path-key.js";
import { isPathStrictlyWithin } from "./is-path-strictly-within.js";

interface PathContainmentInput {
  basePath: string;
  candidatePath: string;
  platform: NodeJS.Platform;
}

export function isPathEqualOrWithin(input: PathContainmentInput): boolean {
  return (
    normalizePathKey(input.basePath, input.platform) ===
      normalizePathKey(input.candidatePath, input.platform) || isPathStrictlyWithin(input)
  );
}
