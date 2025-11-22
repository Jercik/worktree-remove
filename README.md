# worktree-remove

Safely remove a Git worktree and its directory, handling uncommitted changes and orphaned folders.

## What it does

Running `worktree-remove` from inside the main repo:

1.  Ensures you are running from the main worktree.
2.  Finds the worktree directory (expects conventions like `../<repo>-<branch>`).
3.  Checks if the worktree is registered with Git.
4.  Safely handles "orphaned" directories (directories that exist but aren't registered worktrees).
5.  Checks for uncommitted changes (if registered) and asks for confirmation before proceeding.
6.  Unregisters the worktree from Git (`git worktree remove`).
7.  Moves the directory to the system trash instead of permanently deleting it (safer than `rm -rf`).
8.  Verifies the removal was successful.

## Requirements

- Node.js ≥ 22.14.0
- Git with `git worktree` support

## Install / run

You usually don’t need a global install.

```bash
# inside /my/path/my-app (main worktree)
# one‑off
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

You can also specify the branch name directly:

```bash
worktree-remove <branch>
```

Example:

```bash
worktree-remove feature/login-form
```

## License

MIT
