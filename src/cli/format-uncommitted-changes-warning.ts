import type { UncommittedChanges } from "../git/check-uncommitted-changes.js";

interface CheckedTarget {
  name: string;
  uncommittedChanges: UncommittedChanges;
}

export function formatUncommittedChangesWarning(targets: CheckedTarget[]): string[] {
  const dirtyNames: string[] = [];
  const uncheckedLines: string[] = [];
  for (const { name, uncommittedChanges } of targets) {
    if (uncommittedChanges.state === "present") {
      dirtyNames.push(name);
    } else if (uncommittedChanges.state === "unknown") {
      uncheckedLines.push(
        `Could not check '${name}' for uncommitted changes: ${uncommittedChanges.reason}`,
      );
    }
  }

  if (dirtyNames.length === 0) {
    return uncheckedLines;
  }
  const dirtyLine = `${dirtyNames.length} worktree${dirtyNames.length > 1 ? "s have" : " has"} uncommitted changes: ${dirtyNames.join(", ")}`;
  return [dirtyLine, ...uncheckedLines];
}
