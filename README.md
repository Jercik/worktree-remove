# worktree-remove

Safely remove a Git worktree and its directory, handling uncommitted changes and orphaned folders.

## What it does

Running `worktree-remove` from inside the main repo:

1.  Ensures you are running from the main worktree.
2.  Finds the worktree directory in the parent directory (expects `<repo>-<branch>` naming).
3.  Checks if the worktree is registered with Git.
4.  Safely handles "orphaned" directories (directories that exist but Git no longer recognizes as worktrees).
5.  Checks for uncommitted changes (if registered) and, when found, asks "Remove anyway?" before proceeding.
6.  Asks for a final confirmation to remove the registered worktree or orphaned directory.
7.  Unregisters the worktree from Git (`git worktree remove`).
8.  Moves the directory to the system trash instead of permanently deleting it (safer than `rm -rf`).
9.  Verifies the removal was successful.

## Requirements

- Node.js ≥ 22.14.0
- Git with `git worktree` support

## Install / run

You usually don’t need a global install.

```bash
# inside /my/path/my-app (main worktree)
# one-off
npx worktree-remove

# or install globally
pnpm add -g worktree-remove   # or: npm i -g worktree-remove
worktree-remove
```

## Usage

Run this inside the main worktree of your project.

### Interactive Mode (Recommended)

If you don't provide a branch name, or use the `-i` flag, an interactive list of worktrees will be shown:

```bash
# inside /my/path/my-app
worktree-remove
# or
worktree-remove -i
```

This allows you to easily select which worktree to remove from a list.

### Manual Mode

You can also specify the worktree directly by:

- branch name (for worktrees on a branch)
- worktree path (works for detached HEAD worktrees)
- directory name in the parent folder (useful when there's no branch)

```bash
worktree-remove <target>
```

Example:

```bash
worktree-remove feature/login-form
```

Detached HEAD example:

```bash
worktree-remove ../my-app-test-29
```

## License

MIT
