/**
 * Resolve multiple worktree targets for batch removal.
 *
 * For each target: resolves path, asserts safety, checks directory existence,
 * checks uncommitted changes, and gathers display info.
 */

import { directoryExists } from "../fs/check-directory-exists.js";
import { hasUncommittedChanges } from "../git/check-uncommitted-changes.js";
import { assertRemovalSafe } from "../worktree/assert-removal-safe.js";
import {
  getRemovalDisplayInfo,
  type RemovalDisplayInfo,
} from "../worktree/get-removal-display.js";
import { resolveRemovalTarget } from "../worktree/resolve-removal-target.js";

type WorktreeEntry = {
  path: string;
  head: string | undefined;
  branch: string | undefined;
  isDetached: boolean;
};

export type ResolvedTarget = {
  input: string;
  targetPath: string;
  registeredPath: string | undefined;
  registeredWorktree: WorktreeEntry | undefined;
  isPathInputTarget: boolean;
  directoryExists: boolean;
  hasDirtyChanges: boolean;
  displayInfo: RemovalDisplayInfo;
};

type ResolveBatchInput = {
  targets: string[];
  cwd: string;
  mainPath: string;
  worktrees: WorktreeEntry[];
};

export async function resolveBatchTargets(
  input: ResolveBatchInput,
): Promise<ResolvedTarget[]> {
  const resolved: ResolvedTarget[] = [];

  for (const target of input.targets) {
    const trimmedInput = target.trim();
    if (!trimmedInput) continue;

    const resolvedTarget = await resolveRemovalTarget({
      input: trimmedInput,
      cwd: input.cwd,
      mainPath: input.mainPath,
      worktrees: input.worktrees,
      platform: process.platform,
    });

    assertRemovalSafe({
      targetPath: resolvedTarget.targetPath,
      mainPath: input.mainPath,
      registeredPath: resolvedTarget.registeredPath,
    });

    const directoryExists_ = await directoryExists(resolvedTarget.targetPath);
    const hasDirtyChanges =
      resolvedTarget.registeredPath !== undefined &&
      directoryExists_ &&
      hasUncommittedChanges(resolvedTarget.registeredPath);

    const displayInfo = getRemovalDisplayInfo({
      cwd: input.cwd,
      targetPath: resolvedTarget.targetPath,
      registeredPath: resolvedTarget.registeredPath,
      registeredWorktree: resolvedTarget.registeredWorktree,
      isPathInputTarget: resolvedTarget.isPathInputTarget,
    });

    resolved.push({
      input: trimmedInput,
      targetPath: resolvedTarget.targetPath,
      registeredPath: resolvedTarget.registeredPath,
      registeredWorktree: resolvedTarget.registeredWorktree,
      isPathInputTarget: resolvedTarget.isPathInputTarget,
      directoryExists: directoryExists_,
      hasDirtyChanges,
      displayInfo,
    });
  }

  return resolved;
}
