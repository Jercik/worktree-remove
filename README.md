# worktree-remove

Safely remove a Git worktree and its directory, handling uncommitted changes and orphaned folders.

## What it does

Running `worktree-remove`:

1.  Resolves the target worktree/directory (branch name, worktree path, or parent-directory name; supports `<repo>-<branch>` naming).
2.  Checks if the worktree is registered with Git.
3.  Safely handles "orphaned" directories (directories that exist but Git no longer recognizes as worktrees).
4.  Checks for uncommitted changes (if registered) and, when found, asks "Remove anyway?" before proceeding.
5.  Asks for a final confirmation to remove the registered worktree or orphaned directory (unless `--yes` or `--dry-run`).
6.  If you are inside the target directory, warns and switches the process to the main worktree before removal (your shell directory does not change).
7.  Moves the directory to the system trash when possible (safer than `rm -rf`).
8.  Unregisters the worktree from Git (`git worktree remove` / `git worktree prune`).
9.  Reports the outcome when `--verbose` or `--dry-run` is used.

## Requirements

- Node.js ≥ 22.14.0
- Git with `git worktree` support
- Optional: set `WORKTREE_REMOVE_GIT_PATH` to override the git executable

## Install / run

You usually don’t need a global install.

```bash
# inside any worktree of /my/path/my-app
# one-off
npx worktree-remove -i

# or pass a target directly
npx worktree-remove feature/login-form

# or install globally
pnpm add -g worktree-remove   # or: npm i -g worktree-remove
worktree-remove -i
```

## Usage

Run this from any worktree of your project. You can remove a sibling worktree, or even the worktree you are currently in.

By default, the CLI is quiet and requires an explicit target (non-interactive selection). Pass a target explicitly, or use `--interactive` to pick from a list. In a TTY it will still prompt for confirmations unless `--no-interactive`, `--yes`, or `--dry-run` is used. Use `--force` to bypass safety prompts around failures and uncommitted changes.

### Interactive Mode (Recommended)

Use the `-i` flag to open an interactive list of worktrees:

```bash
# inside any worktree for the repository
worktree-remove -i
```

This allows you to easily select which worktree to remove from a list.

### Manual Mode

You can also specify the worktree directly by:

- branch name (for worktrees on a branch)
- worktree path (works for detached HEAD worktrees)
- directory name in the parent folder (useful when there's no branch)

Note: If you pass a path that exists but isn't a registered worktree, it will be treated as an orphaned directory and moved to trash after confirmation. Path targets can point anywhere, so use caution when providing absolute or home-relative paths.
For safety, unregistered directories inside the main worktree are refused.

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

Sibling directory name example:

```bash
worktree-remove my-app-test-29
```

## Options

- `-i, --interactive` interactively select a worktree to remove
- `--no-interactive` disable all prompts and interactive selection
- `-y, --yes` assume yes for all confirmation prompts
- `-f, --force` skip safety prompts on failures and uncommitted changes (final confirmation still required unless `--yes` or `--dry-run`)
- `--dry-run` show what would be removed without making changes
- `--verbose` show detailed progress output
- `--quiet` suppress non-error output

## Examples

```bash
# remove a worktree by branch name
worktree-remove feature/login-form
```

```bash
# preview what would be removed
worktree-remove --dry-run feature/login-form
```

```bash
# use an interactive selector
worktree-remove --interactive
```

```bash
# pipe a worktree path from git + fzf
git worktree list --porcelain | rg '^worktree ' | sed 's/^worktree //' | fzf | xargs worktree-remove --yes
```

## Automation Notes

In CI or non-interactive shells, pass `--yes` or `--dry-run`. Use `--no-interactive` to prevent any prompts.

## Agent Rule

Add to your `CLAUDE.md` or `AGENTS.md`:

```markdown
# Rule: `worktree-remove` Usage

Run `npx -y worktree-remove --help` to learn available options.

Use `worktree-remove` when you need to safely remove Git worktrees.
It handles uncommitted changes, orphaned directories, and moves
files to trash instead of permanent deletion.
```

## License

MIT
