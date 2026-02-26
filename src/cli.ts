#!/usr/bin/env -S node --experimental-strip-types
/**
 * worktree-remove.ts
 *
 * Remove one or more Git worktrees and/or their directories for given targets.
 * Handles registered worktrees, detached HEAD worktrees, and orphaned directories.
 *
 * This script:
 * 1. Resolves the targets (branch/path/directory name)
 * 2. Checks if they're registered as Git worktrees
 * 3. Unregisters them if needed
 * 4. Offers to delete the directories if they exist
 */

import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import packageJson from "../package.json" with { type: "json" };
import { createOutputWriter } from "./cli/output-writer.js";
import { removeBatch } from "./cli/remove-batch.js";
import { selectWorktrees } from "./cli/select-worktree.js";
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
    "[target...]",
    "branch names, worktree paths, or directory names of worktrees to remove",
  )
  .option("-i, --interactive", "interactively select worktrees to remove")
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
  .action(async (targets: string[], options: CliOptions) => {
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

      if (options.interactive && targets.length > 0) {
        output.warn(
          chalk.yellow(
            `Ignoring target${targets.length > 1 ? "s" : ""} '${targets.join("', '")}' because --interactive was specified.`,
          ),
        );
      }

      if (targets.length === 0 && !interactiveSelection) {
        output.error(
          "Missing target worktree. Provide a target or use --interactive.",
        );
        process.exit(1);
      }

      const selectedTargets = interactiveSelection
        ? await selectWorktrees(output)
        : targets;

      if (selectedTargets.length === 0) {
        process.exit(0);
      }

      await removeBatch(selectedTargets, {
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
  worktree-remove feature/login feature/signup
  worktree-remove --dry-run feature/login feature/signup
  worktree-remove --yes feature/login

Notes:
  Requires git. Override the path with WORKTREE_REMOVE_GIT_PATH.
  Output is quiet by default; use --verbose or --dry-run for details.
  If your current directory is inside a target directory, the process switches to the main worktree before deletion.
  In CI or non-interactive shells, pass --yes or --dry-run.`,
);

await program.parseAsync();
