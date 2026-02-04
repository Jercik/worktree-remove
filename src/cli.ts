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
import { selectWorktree } from "./cli/select-worktree.js";

const program = new Command()
  .name(packageJson.name)
  .description("Remove a Git worktree and/or its directory")
  .version(packageJson.version)
  .argument(
    "[target]",
    "branch name, worktree path, or directory name of the worktree to remove",
  )
  .option("-i, --interactive", "interactively select a worktree to remove")
  .action(
    async (target: string | undefined, options: { interactive?: boolean }) => {
      try {
        if (options.interactive && target) {
          console.log(
            chalk.yellow(
              `Ignoring target '${target}' because --interactive was specified.`,
            ),
          );
        }

        const targetInput =
          options.interactive || !target ? await selectWorktree() : target;

        if (!targetInput) {
          process.exit(0);
        }

        await removeWorktree(targetInput);
      } catch (error: unknown) {
        console.error(chalk.red("Error:"), error);
        // eslint-disable-next-line require-atomic-updates
        process.exitCode = 1;
      }
    },
  );

program.parse();
