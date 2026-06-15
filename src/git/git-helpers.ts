import { spawnSync } from "node:child_process";
import * as readline from "node:readline/promises";
import chalk from "chalk";

function getGitExecutable(): string {
  const configuredPath = process.env.WORKTREE_REMOVE_GIT_PATH?.trim();
  return configuredPath && configuredPath.length > 0 ? configuredPath : "git";
}

export function ensureGitAvailable(): void {
  const gitExecutable = getGitExecutable();
  const result = spawnSync(gitExecutable, ["--version"], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    const hint =
      gitExecutable === "git"
        ? "Install Git or set WORKTREE_REMOVE_GIT_PATH to a git executable."
        : `Check WORKTREE_REMOVE_GIT_PATH ('${gitExecutable}') or install Git.`;
    exitWithMessage(`Git is required. ${hint}`);
  }
}

/**
 * Run a git command synchronously and return its trimmed stdout.
 * Any failure causes the script to throw.
 * @param args Git command arguments. If the last argument is an object with a `cwd` property,
 *             it will be used as the working directory for the command.
 */
export function git(...arguments_: [...string[], { cwd?: string }] | string[]): string {
  const gitExecutable = getGitExecutable();
  let cwd: string | undefined;
  let gitArguments: string[];

  // Check if the last argument is an options object
  const lastArgument = arguments_.at(-1);
  if (lastArgument && typeof lastArgument === "object" && "cwd" in lastArgument) {
    cwd = lastArgument.cwd;
    gitArguments = arguments_.slice(0, -1) as string[];
  } else {
    gitArguments = arguments_ as string[];
  }

  const result = spawnSync(gitExecutable, gitArguments, {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024, // 100 MB to accommodate large outputs
    ...(cwd && { cwd }),
  });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Git executable not found at '${gitExecutable}'. Set WORKTREE_REMOVE_GIT_PATH or install Git.`,
      );
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${gitArguments[0] ?? "command"} failed`);
  }
  return result.stdout.trim();
}

export function normalizeBranchName(name: string): string {
  const trimmed = name.trim();
  return trimmed
    .replace(/^refs\/heads\//u, "")
    .replace(/^refs\/remotes\/origin\//u, "")
    .replace(/^remotes\/origin\//u, "")
    .replace(/^origin\//u, "");
}

export function exitWithMessage(message: string): never {
  console.error(chalk.red(message));
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}
