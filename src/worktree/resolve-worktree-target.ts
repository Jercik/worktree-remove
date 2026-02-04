import os from "node:os";
import path from "node:path";
import { normalizeBranchName } from "../git/git-helpers.js";
import { normalizeGitPath } from "../git/normalize-git-path.js";
import type { WorktreeEntry } from "../git/parse-worktree-list.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";

export type ResolveWorktreeTargetInput = {
  input: string;
  cwd: string;
  mainPath: string;
  worktrees: WorktreeEntry[];
};

export type ResolvedWorktreeTarget =
  | { kind: "registered"; worktree: WorktreeEntry }
  | {
      kind: "candidates";
      candidatePaths: string[];
      resolvedInputPath: string;
      isPathInput: boolean;
      input: string;
    }
  | { kind: "ambiguous"; message: string };

function looksLikePathInput(input: string): boolean {
  if (input === "") return false;
  // Treat any leading "." as path input (e.g., "./wt", "../wt", ".git").
  // Git disallows branch names starting with ".", so this avoids ambiguity.
  // Hidden sibling directories can still be targeted via an explicit path like
  // "../.hidden-dir".
  if (input.startsWith(".")) return true;
  if (input.startsWith("~/") || input.startsWith("~\\")) return true;
  return path.isAbsolute(input) || path.win32.isAbsolute(input);
}

function expandHomeDirectory(input: string): string {
  if (!input.startsWith("~/") && !input.startsWith("~\\")) return input;
  return path.join(os.homedir(), input.slice(2));
}

export function resolveWorktreeTarget(
  parameters: ResolveWorktreeTargetInput,
): ResolvedWorktreeTarget {
  const trimmedInput = parameters.input.trim();
  const isPathInput = looksLikePathInput(trimmedInput);

  const worktreesByBranch = new Map<string, WorktreeEntry>();
  const worktreesByPath = new Map<string, WorktreeEntry>();

  for (const worktree of parameters.worktrees) {
    worktreesByPath.set(normalizePathKey(worktree.path), worktree);
    if (worktree.branch) {
      worktreesByBranch.set(worktree.branch, worktree);
    }
  }

  const normalizedBranch = isPathInput
    ? undefined
    : normalizeBranchName(trimmedInput);

  const resolvedInputPath = path.resolve(
    parameters.cwd,
    isPathInput
      ? normalizeGitPath(expandHomeDirectory(trimmedInput))
      : trimmedInput,
  );

  const mainRepoName = path.basename(parameters.mainPath);
  const parentDirectory = path.dirname(parameters.mainPath);

  const expectedPath = normalizedBranch
    ? path.join(parentDirectory, `${mainRepoName}-${normalizedBranch}`)
    : undefined;

  const hasPathSeparator =
    trimmedInput.includes(path.posix.sep) ||
    trimmedInput.includes(path.win32.sep);
  const siblingPath =
    isPathInput || hasPathSeparator
      ? undefined
      : path.join(parentDirectory, trimmedInput);

  if (normalizedBranch) {
    const byBranch = worktreesByBranch.get(normalizedBranch);
    if (byBranch) {
      return { kind: "registered", worktree: byBranch };
    }
  }

  const directMatch =
    worktreesByPath.get(normalizePathKey(resolvedInputPath)) ??
    (expectedPath
      ? worktreesByPath.get(normalizePathKey(expectedPath))
      : undefined) ??
    (siblingPath
      ? worktreesByPath.get(normalizePathKey(siblingPath))
      : undefined);

  if (directMatch) {
    return { kind: "registered", worktree: directMatch };
  }

  const isWin32 = process.platform === "win32";
  const normalizedBasenameInput = isWin32
    ? trimmedInput.toLowerCase()
    : trimmedInput;

  const basenameMatches = parameters.worktrees.filter((worktree) => {
    const basename = path.basename(worktree.path);
    const normalizedBasename = isWin32 ? basename.toLowerCase() : basename;
    return normalizedBasename === normalizedBasenameInput;
  });

  if (basenameMatches.length === 1 && basenameMatches[0]) {
    return { kind: "registered", worktree: basenameMatches[0] };
  }

  if (basenameMatches.length > 1) {
    return {
      kind: "ambiguous",
      message: `Multiple worktrees match '${trimmedInput}'. Re-run with --interactive or pass a full path.`,
    };
  }

  const candidatePaths = isPathInput
    ? [resolvedInputPath]
    : [expectedPath, siblingPath].filter(
        (candidate): candidate is string => candidate !== undefined,
      );

  return {
    kind: "candidates",
    candidatePaths,
    resolvedInputPath,
    isPathInput,
    input: trimmedInput,
  };
}
