import os from "node:os";
import path from "node:path";
import { normalizeBranchName } from "../git/git-helpers.js";
import { normalizeGitPath } from "../git/normalize-git-path.js";
import { normalizePathKey } from "../fs/normalize-path-key.js";

type WorktreeEntry = {
  path: string;
  head: string | undefined;
  branch: string | undefined;
  isDetached: boolean;
};

type ResolveWorktreeTargetInput = {
  input: string;
  cwd: string;
  mainPath: string;
  worktrees: WorktreeEntry[];
  platform: NodeJS.Platform;
};

type ResolvedWorktreeTarget =
  | { kind: "registered"; worktree: WorktreeEntry; isPathInput: boolean }
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
  // path.isAbsolute uses the runtime platform's rules; path.win32.isAbsolute
  // adds Windows drive-letter detection (e.g. C:\) when running on POSIX.
  // Both recognize "/" as absolute, so this covers all platforms.
  return path.isAbsolute(input) || path.win32.isAbsolute(input);
}

function expandHomeDirectory(
  input: string,
  pathApi: typeof path.posix,
): string {
  if (!input.startsWith("~/") && !input.startsWith("~\\")) return input;
  return pathApi.join(os.homedir(), input.slice(2));
}

function containsParentDirectorySegment(input: string): boolean {
  return input.split(/[\\/]/u).includes("..");
}

export function resolveWorktreeTarget(
  parameters: ResolveWorktreeTargetInput,
): ResolvedWorktreeTarget {
  const pathApi = parameters.platform === "win32" ? path.win32 : path.posix;
  const trimmedInput = parameters.input.trim();
  const isPathInput = looksLikePathInput(trimmedInput);

  const worktreesByBranch = new Map<string, WorktreeEntry>();
  const worktreesByPath = new Map<string, WorktreeEntry>();

  for (const worktree of parameters.worktrees) {
    worktreesByPath.set(
      normalizePathKey(worktree.path, parameters.platform),
      worktree,
    );
    if (worktree.branch) {
      worktreesByBranch.set(worktree.branch, worktree);
    }
  }

  const normalizedBranch = isPathInput
    ? undefined
    : normalizeBranchName(trimmedInput);

  if (normalizedBranch && containsParentDirectorySegment(normalizedBranch)) {
    return {
      kind: "ambiguous",
      message: `Input '${trimmedInput}' contains '..' path segments. Pass a full path or use --interactive.`,
    };
  }

  const resolvedInputPath = pathApi.resolve(
    parameters.cwd,
    isPathInput
      ? normalizeGitPath(
          expandHomeDirectory(trimmedInput, pathApi),
          parameters.platform,
        )
      : trimmedInput,
  );

  const mainRepoName = pathApi.basename(parameters.mainPath);
  const parentDirectory = pathApi.dirname(parameters.mainPath);

  const expectedPath = normalizedBranch
    ? pathApi.join(parentDirectory, `${mainRepoName}-${normalizedBranch}`)
    : undefined;

  const hasPathSeparator =
    trimmedInput.includes(path.posix.sep) ||
    trimmedInput.includes(path.win32.sep);
  const siblingPath =
    isPathInput || hasPathSeparator
      ? undefined
      : pathApi.join(parentDirectory, trimmedInput);

  if (normalizedBranch) {
    const byBranch = worktreesByBranch.get(normalizedBranch);
    if (byBranch) {
      return { kind: "registered", worktree: byBranch, isPathInput };
    }
  }

  const directMatch =
    worktreesByPath.get(
      normalizePathKey(resolvedInputPath, parameters.platform),
    ) ??
    (expectedPath
      ? worktreesByPath.get(normalizePathKey(expectedPath, parameters.platform))
      : undefined) ??
    (siblingPath
      ? worktreesByPath.get(normalizePathKey(siblingPath, parameters.platform))
      : undefined);

  if (directMatch) {
    return { kind: "registered", worktree: directMatch, isPathInput };
  }

  const isWin32 = parameters.platform === "win32";
  const normalizedBasenameInput = isWin32
    ? trimmedInput.toLowerCase()
    : trimmedInput;

  const basenameMatches = parameters.worktrees.filter((worktree) => {
    const basename = pathApi.basename(worktree.path);
    const normalizedBasename = isWin32 ? basename.toLowerCase() : basename;
    return normalizedBasename === normalizedBasenameInput;
  });

  if (basenameMatches.length === 1 && basenameMatches[0]) {
    return { kind: "registered", worktree: basenameMatches[0], isPathInput };
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
