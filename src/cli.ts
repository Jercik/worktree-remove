#!/usr/bin/env -S node --experimental-strip-types
/**
 * worktree-remove.ts
 *
 * Remove a Git worktree and/or its directory for a given target.
 * Handles registered worktrees, detached HEAD worktrees, and orphaned directories.
 *
 * This script:
 * 1. Resolves the target (branch/path/directory name)
 * 2. Checks if it's registered as a Git worktree
 * 3. Unregisters it if needed
 * 4. Offers to delete the directory if it exists
 */

import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import packageJson from "../package.json" with { type: "json" };
import { createOutputWriter } from "./cli/output-writer.js";
import { removeWorktree } from "./worktree/remove-worktree.js";
import { selectWorktree } from "./cli/select-worktree.js";
import { ensureGitAvailable } from "./git/git-helpers.js";

const shouldUseColor = process.stderr.isTTY && !process.env.NO_COLOR;
chalk.level = shouldUseColor ? 3 : 0;

process.on("SIGINT", () => {
  console.error("\nInterrupted");
  process.exit(130);
});

type CliOptions = {
  interactive?: boolean;
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
};

const program = new Command()
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .argument(
    "[target]",
    "branch name, worktree path, or directory name of the worktree to remove",
  )
  .option("-i, --interactive", "interactively select a worktree to remove")
  .option("--no-interactive", "disable all prompts and interactive selection")
  .option("-y, --yes", "assume yes for all confirmation prompts")
  .option(
    "-f, --force",
    "skip safety prompts on failures and uncommitted changes",
  )
  .option("--dry-run", "show what would be removed without making changes")
  .option("--verbose", "show detailed progress output")
  .option("--quiet", "suppress non-error output")
  .showHelpAfterError("(add --help for additional information)")
  .showSuggestionAfterError()
  .action(async (target: string | undefined, options: CliOptions) => {
    try {
      ensureGitAvailable();

      const dryRun = options.dryRun ?? false;
      const verbose = options.verbose ?? false;
      const quiet = options.quiet ?? false;
      const output = createOutputWriter({ dryRun, verbose, quiet });
      const force = options.force === true;
      const assumeYes = options.yes === true || dryRun;

      const isCi = process.env.CI !== undefined;
      const interactiveSelection = options.interactive === true;
      const promptsDisabled =
        options.interactive === false ||
        isCi ||
        !process.stdin.isTTY ||
        !process.stderr.isTTY;
      const allowPrompt = !promptsDisabled;

      if (interactiveSelection && !allowPrompt) {
        output.error(
          "Interactive selection is disabled in non-interactive mode. Provide a target or re-run without CI/--no-interactive.",
        );
        process.exit(1);
      }

      if (options.interactive && target) {
        output.warn(
          chalk.yellow(
            `Ignoring target '${target}' because --interactive was specified.`,
          ),
        );
      }

      if (!target && !interactiveSelection) {
        output.error(
          "Missing target worktree. Provide a target or use --interactive.",
        );
        process.exit(1);
      }

      const targetInput = interactiveSelection
        ? await selectWorktree(output)
        : target;

      if (!targetInput) {
        process.exit(0);
      }

      await removeWorktree(targetInput, {
        dryRun,
        assumeYes,
        force,
        allowPrompt,
        output,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

program.addHelpText(
  "after",
  `
Examples:
  worktree-remove --interactive
  worktree-remove feature/login
  worktree-remove --dry-run feature/login
  worktree-remove --yes feature/login

Notes:
  Requires git. Override the path with WORKTREE_REMOVE_GIT_PATH.
  Output is quiet by default; use --verbose or --dry-run for details.
  If the target contains your current directory, the process switches to the main worktree before deletion.
  In CI or non-interactive shells, pass --yes or --dry-run.`,
);

await program.parseAsync();
