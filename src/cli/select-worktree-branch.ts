/**
 * Interactively select a worktree branch to remove (CLI layer)
 */

import inquirer from "inquirer";
import chalk from "chalk";
import { getWorktreeBranches } from "../git/get-worktree-branches.js";

export async function selectWorktreeBranch(): Promise<string | undefined> {
  const branches = getWorktreeBranches();

  if (branches.length === 0) {
    console.log(chalk.yellow("No worktrees found to remove."));
    return undefined;
  }

  const { selectedBranch } = await inquirer.prompt<{
    selectedBranch: string;
  }>([
    {
      type: "select",
      name: "selectedBranch",
      message: "Select a worktree to remove:",
      choices: branches.map((branch) => ({
        name: branch,
        value: branch,
      })),
      pageSize: 15,
      loop: false,
    },
  ]);

  return selectedBranch;
}
