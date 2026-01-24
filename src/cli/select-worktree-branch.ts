/**
 * Interactively select a worktree branch to remove (CLI layer)
 */

import path from "node:path";
import inquirer from "inquirer";
import chalk from "chalk";
import { getWorktreeInfo } from "../git/get-worktree-info.js";

export async function selectWorktreeBranch(): Promise<string | undefined> {
  const { worktrees } = getWorktreeInfo();

  if (worktrees.size === 0) {
    console.log(chalk.yellow("No worktrees found to remove."));
    return undefined;
  }

  const cwd = process.cwd();
  const choices = [...worktrees.entries()].map(([branch, worktreePath]) => ({
    name: `${branch} (${path.relative(cwd, worktreePath)})`,
    value: branch,
  }));

  const { selectedBranch } = await inquirer.prompt<{
    selectedBranch: string;
  }>([
    {
      type: "select",
      name: "selectedBranch",
      message: "Select a worktree to remove:",
      choices,
      pageSize: 15,
      loop: false,
    },
  ]);

  return selectedBranch;
}
