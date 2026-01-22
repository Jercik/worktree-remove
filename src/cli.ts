#!/usr/bin/env -S node --experimental-strip-types
/**
 * worktree-remove.ts
 *
 * Remove a Git worktree and/or its directory for a given branch.
 * Handles both registered worktrees and orphaned directories.
 *
 * This script:
 * 1. Finds the expected worktree directory (following naming convention: repo-branch)
 * 2. Checks if it's registered as a Git worktree
 * 3. Unregisters it if needed
 * 4. Offers to delete the directory if it exists
 */

import { Command } from "commander";
import chalk from "chalk";
import packageJson from "../package.json" with { type: "json" };
import { removeWorktree } from "./worktree/remove-worktree.js";
import { selectWorktreeBranch } from "./cli/select-worktree-branch.js";

const program = new Command()
  .name(packageJson.name)
  .description("Remove a Git worktree and/or its directory")
  .version(packageJson.version)
  .argument("[branch]", "branch name of the worktree to remove")
  .option("-i, --interactive", "interactively select a worktree to remove")
  .option("-y, --yes", "skip confirmation prompts")
  .action(
    async (
      branch: string | undefined,
      options: { interactive?: boolean; yes?: boolean },
    ) => {
      try {
        let targetBranch = branch;

        if (options.interactive || !targetBranch) {
          // Interactive mode: show list of worktrees
          targetBranch = await selectWorktreeBranch();

          if (!targetBranch) {
            process.exit(0);
          }
        }

        if (!targetBranch) {
          console.error(
            chalk.red(
              "No branch specified. Use --interactive or provide a branch name.",
            ),
          );
          process.exit(1);
        }

        await removeWorktree(targetBranch, { skipConfirmations: options.yes });
      } catch (error: unknown) {
        console.error(chalk.red("Error:"), error);
        // eslint-disable-next-line require-atomic-updates
        process.exitCode = 1;
      }
    },
  );

program.parse();
