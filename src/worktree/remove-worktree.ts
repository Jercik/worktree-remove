/**
 * Main worktree removal use case (domain layer).
 *
 * Orchestrates:
 * - Validating execution from the main worktree
 * - Resolving the target worktree path
 * - Guard rails around uncommitted changes
 * - Unregistering the worktree
 * - Moving the directory to trash
 */

import path from "node:path";
import { exitWithMessage, confirm } from "../git/git-helpers.js";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import { hasUncommittedChanges } from "../git/check-uncommitted-changes.js";
import { directoryExists } from "../fs/check-directory-exists.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";
import { performWorktreeRemoval } from "./perform-worktree-removal.js";
import { resolveWorktreeTarget } from "./resolve-worktree-target.js";

export async function removeWorktree(input: string): Promise<void> {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    exitWithMessage("No branch or path specified.");
  }

  // Get worktree information
  const { mainPath, worktrees } = getWorktreeInfo();

  // Ensure we're running from the main worktree
  const cwd = process.cwd();
  if (normalizePathKey(cwd) !== normalizePathKey(mainPath)) {
    exitWithMessage(
      "This command must be run from the main repository worktree.",
    );
  }

  const resolvedTarget = resolveWorktreeTarget({
    input: trimmedInput,
    cwd,
    mainPath,
    worktrees,
    platform: process.platform,
  });

  if (resolvedTarget.kind === "ambiguous") {
    exitWithMessage(resolvedTarget.message);
  }

  const isPathInputTarget =
    resolvedTarget.kind === "candidates" && resolvedTarget.isPathInput;

  let registeredPath: string | undefined;
  const registeredWorktreeFinal =
    resolvedTarget.kind === "registered" ? resolvedTarget.worktree : undefined;
  let targetPath: string;

  if (resolvedTarget.kind === "registered") {
    registeredPath = resolvedTarget.worktree.path;
    targetPath = resolvedTarget.worktree.path;
  } else {
    const existingCandidatePaths: string[] = [];

    for (const candidatePath of resolvedTarget.candidatePaths) {
      if (await directoryExists(candidatePath)) {
        existingCandidatePaths.push(candidatePath);
      }
    }

    if (existingCandidatePaths.length === 0) {
      exitWithMessage(
        resolvedTarget.isPathInput
          ? `No worktree or directory found at '${resolvedTarget.resolvedInputPath}'.`
          : `No worktree or directory found for '${resolvedTarget.input}'.`,
      );
    }

    if (existingCandidatePaths.length > 1) {
      const [first, second] = existingCandidatePaths;
      exitWithMessage(
        `Multiple directories exist for '${resolvedTarget.input}': '${first}' and '${second}'. Re-run with --interactive or pass a full path.`,
      );
    }

    const existingPath = existingCandidatePaths[0];
    if (!existingPath) {
      exitWithMessage(
        resolvedTarget.isPathInput
          ? `No worktree or directory found at '${resolvedTarget.resolvedInputPath}'.`
          : `No worktree or directory found for '${resolvedTarget.input}'.`,
      );
    }

    targetPath = existingPath;
  }

  const resolvedTargetPath = path.resolve(targetPath);
  if (path.parse(resolvedTargetPath).root === resolvedTargetPath) {
    exitWithMessage("Refusing to remove a filesystem root directory.");
  }

  targetPath = resolvedTargetPath;
  const targetDirectoryName = path.basename(targetPath);

  // Check if directory exists
  const directoryExists_ = await directoryExists(targetPath);

  // Safety check: don't remove the main worktree
  if (normalizePathKey(targetPath) === normalizePathKey(mainPath)) {
    exitWithMessage("Refusing to remove the main worktree.");
  }

  const relativeMainToTarget = path.relative(
    path.resolve(targetPath),
    path.resolve(mainPath),
  );
  const targetContainsMain =
    relativeMainToTarget !== "" &&
    !path.isAbsolute(relativeMainToTarget) &&
    relativeMainToTarget !== ".." &&
    !relativeMainToTarget.startsWith(`..${path.sep}`);

  if (targetContainsMain) {
    exitWithMessage(
      "Refusing to remove a directory containing the main worktree.",
    );
  }

  const relativeTargetToMain = path.relative(
    path.resolve(mainPath),
    path.resolve(targetPath),
  );
  const mainContainsTarget =
    relativeTargetToMain !== "" &&
    !path.isAbsolute(relativeTargetToMain) &&
    relativeTargetToMain !== ".." &&
    !relativeTargetToMain.startsWith(`..${path.sep}`);

  if (!registeredPath && mainContainsTarget) {
    exitWithMessage(
      "Refusing to remove an unregistered directory inside the main worktree.",
    );
  }

  // Check for uncommitted changes if it's a registered worktree
  if (
    registeredPath &&
    directoryExists_ &&
    hasUncommittedChanges(registeredPath)
  ) {
    const proceed = await confirm(
      "Worktree has uncommitted changes. Remove anyway?",
    );
    if (!proceed) {
      console.log("Removal cancelled.");
      return;
    }
  }

  // Get user confirmation
  const status = registeredPath
    ? "registered worktree"
    : isPathInputTarget
      ? "unregistered directory"
      : "orphaned directory";
  const referenceInfo = (() => {
    if (!registeredWorktreeFinal || !registeredPath) return "";
    if (registeredWorktreeFinal.branch)
      return ` (branch ${registeredWorktreeFinal.branch})`;
    const head = registeredWorktreeFinal.head?.slice(0, 7);
    return head ? ` (detached HEAD @ ${head})` : " (detached HEAD)";
  })();

  const displayPath = isPathInputTarget
    ? targetPath
    : path.relative(cwd, targetPath) || targetPath;
  const confirmed = await confirm(
    `Remove ${status} '${targetDirectoryName}' (${displayPath})${referenceInfo}?`,
  );

  if (!confirmed) {
    console.log("Removal cancelled.");
    return;
  }

  await performWorktreeRemoval({
    status,
    targetDirectoryName,
    targetPath,
    mainPath,
    registeredPath,
    directoryExistedInitially: directoryExists_,
  });
}
