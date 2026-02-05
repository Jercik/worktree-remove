/**
 * Interactively select a worktree to remove (CLI layer)
 */

import path from "node:path";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import type { OutputWriter } from "./output-writer.js";

const shouldUseColor = process.stderr.isTTY && !process.env.NO_COLOR;
chalk.level = shouldUseColor ? 3 : 0;

export async function selectWorktree(
  output: OutputWriter,
): Promise<string | undefined> {
  const { worktrees } = getWorktreeInfo();

  if (worktrees.length === 0) {
    output.warn(chalk.yellow("No worktrees found to remove."));
    return undefined;
  }

  const cwd = process.cwd();
  const choices = worktrees
    .toSorted((a, b) => (a.branch ?? a.path).localeCompare(b.branch ?? b.path))
    .map((worktree) => {
      const relativePath = path.relative(cwd, worktree.path);
      const head = worktree.head?.slice(0, 7);
      const label =
        worktree.branch ??
        (worktree.isDetached
          ? `(detached${head ? ` @ ${head}` : ""})`
          : `(no branch)`);

      return {
        name: `${label} (${relativePath})`,
        value: worktree.path,
      };
    });

  return select(
    {
      message: "Select a worktree to remove:",
      choices,
      pageSize: 15,
      loop: false,
    },
    {
      input: process.stdin,
      output: process.stderr,
    },
  );
}
