import { git } from "./git-helpers.js";

export type UncommittedChanges =
  | { state: "none" }
  | { state: "present" }
  | { state: "unknown"; reason: string };

export function checkUncommittedChanges(worktreePath: string): UncommittedChanges {
  let status: string;
  try {
    status = git("-C", worktreePath, "status", "--porcelain");
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message.trim() : String(error);
    return { state: "unknown", reason };
  }
  return status === "" ? { state: "none" } : { state: "present" };
}
