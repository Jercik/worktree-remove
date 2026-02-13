/**
 * Interactively select a worktree to remove (CLI layer)
 */

import path from "node:path";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { getWorktreeInfo } from "../git/get-worktree-info.js";
import type { OutputWriter } from "./output-writer.js";
import { isPathEqualOrWithin } from "../worktree/is-path-equal-or-within.js";

const shouldUseColor = process.stderr.isTTY && !process.env.NO_COLOR;
chalk.level = shouldUseColor ? 3 : 0;

export async function selectWorktree(
  output: OutputWriter,
): Promise<string | undefined> {
  const { mainPath, worktrees } = getWorktreeInfo();
  const cwd = process.cwd();

  const sortedWorktrees = worktrees.toSorted((a, b) =>
    (a.branch ?? a.path).localeCompare(b.branch ?? b.path),
  );

  if (sortedWorktrees.length === 0) {
    // @inquirer/select requires at least one selectable choice.
    output.warn(
      chalk.yellow(
        "No removable worktrees found. The main worktree is not selectable.",
      ),
    );
    return undefined;
  }

  const currentLinkedWorktreePath = sortedWorktrees
    .filter((worktree) =>
      isPathEqualOrWithin({
        basePath: worktree.path,
        candidatePath: cwd,
        platform: process.platform,
      }),
    )
    .toSorted((a, b) => b.path.length - a.path.length)[0]?.path;

  const isCurrentMain =
    currentLinkedWorktreePath === undefined &&
    isPathEqualOrWithin({
      basePath: mainPath,
      candidatePath: cwd,
      platform: process.platform,
    });

  const choices = [
    {
      name: `main worktree (${
        path.relative(cwd, mainPath) || "main"
      }, cannot remove)${isCurrentMain ? " [current]" : ""}`,
      value: mainPath,
      disabled: "Main worktree cannot be removed.",
    },
    ...sortedWorktrees.map((worktree) => {
      const relativePath = path.relative(cwd, worktree.path) || ".";
      const head = worktree.head?.slice(0, 7);
      const label =
        worktree.branch ??
        (worktree.isDetached
          ? `(detached${head ? ` @ ${head}` : ""})`
          : `(no branch)`);

      const isCurrentWorktree = currentLinkedWorktreePath === worktree.path;

      return {
        name: `${label} (${relativePath})${
          isCurrentWorktree ? " [current]" : ""
        }`,
        value: worktree.path,
      };
    }),
  ];

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
