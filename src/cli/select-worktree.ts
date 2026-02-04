/**
 * Interactively select a worktree to remove (CLI layer)
 */

import path from "node:path";
import inquirer from "inquirer";
import chalk from "chalk";
import { getWorktreeInfo } from "../git/get-worktree-info.js";

export async function selectWorktree(): Promise<string | undefined> {
  const { worktrees } = getWorktreeInfo();

  if (worktrees.length === 0) {
    console.log(chalk.yellow("No worktrees found to remove."));
    return undefined;
  }

  const cwd = process.cwd();
  const choices = worktrees
    .toSorted((a, b) => (a.branch ?? a.path).localeCompare(b.branch ?? b.path))
    .map((worktree) => {
      const relativePath = path.relative(cwd, worktree.path);
      const head = worktree.head?.slice(0, 7);
      const detachedLabel = head && `detached @ ${head}`;
      const label = worktree.branch ?? `(${detachedLabel ?? "detached"})`;

      return {
        name: `${label} (${relativePath})`,
        value: worktree.path,
      };
    });

  const { selectedWorktree } = await inquirer.prompt<{
    selectedWorktree: string;
  }>([
    {
      type: "select",
      name: "selectedWorktree",
      message: "Select a worktree to remove:",
      choices,
      pageSize: 15,
      loop: false,
    },
  ]);

  return selectedWorktree;
}
