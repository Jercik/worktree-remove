import { describe, it, expect } from "vitest";
import { parseWorktreeListPorcelain } from "./parse-worktree-list.js";

describe("parseWorktreeListPorcelain", () => {
  it("parses branch and detached worktrees from porcelain output", () => {
    const output = `worktree /repo/main
HEAD 1111111111111111111111111111111111111111
branch refs/heads/main

worktree /repo/wt-branch
HEAD 2222222222222222222222222222222222222222
branch refs/heads/feature/foo

worktree /repo/wt-detached
HEAD 3333333333333333333333333333333333333333
detached
`;

    expect(parseWorktreeListPorcelain(output)).toEqual({
      mainPath: "/repo/main",
      worktrees: [
        {
          path: "/repo/main",
          head: "1111111111111111111111111111111111111111",
          branch: "main",
          isDetached: false,
        },
        {
          path: "/repo/wt-branch",
          head: "2222222222222222222222222222222222222222",
          branch: "feature/foo",
          isDetached: false,
        },
        {
          path: "/repo/wt-detached",
          head: "3333333333333333333333333333333333333333",
          branch: undefined,
          isDetached: true,
        },
      ],
    });
  });

  it("parses NUL-separated porcelain output (git worktree list --porcelain -z)", () => {
    const output =
      "worktree /repo/main\0HEAD 1111111111111111111111111111111111111111\0branch refs/heads/main\0\0worktree /repo/wt-detached\0HEAD 3333333333333333333333333333333333333333\0detached\0\0";

    expect(parseWorktreeListPorcelain(output)).toEqual({
      mainPath: "/repo/main",
      worktrees: [
        {
          path: "/repo/main",
          head: "1111111111111111111111111111111111111111",
          branch: "main",
          isDetached: false,
        },
        {
          path: "/repo/wt-detached",
          head: "3333333333333333333333333333333333333333",
          branch: undefined,
          isDetached: true,
        },
      ],
    });
  });

  it("preserves worktree path whitespace in NUL-separated output", () => {
    const output =
      "worktree /repo/main\u0020\0HEAD 1111111111111111111111111111111111111111\0branch refs/heads/main\0\0";

    expect(parseWorktreeListPorcelain(output)).toEqual({
      mainPath: "/repo/main\u0020",
      worktrees: [
        {
          path: "/repo/main\u0020",
          head: "1111111111111111111111111111111111111111",
          branch: "main",
          isDetached: false,
        },
      ],
    });
  });

  it("parses detached lines with trailing whitespace", () => {
    const output = `worktree /repo/wt-detached
HEAD 3333333333333333333333333333333333333333
detached\t
`;

    expect(parseWorktreeListPorcelain(output)).toEqual({
      mainPath: "/repo/wt-detached",
      worktrees: [
        {
          path: "/repo/wt-detached",
          head: "3333333333333333333333333333333333333333",
          branch: undefined,
          isDetached: true,
        },
      ],
    });
  });

  it("returns empty result for empty output", () => {
    expect(parseWorktreeListPorcelain("")).toEqual({
      mainPath: "",
      worktrees: [],
    });
  });

  it("parses a single worktree with no additional fields", () => {
    expect(parseWorktreeListPorcelain("worktree /repo/main\n")).toEqual({
      mainPath: "/repo/main",
      worktrees: [
        {
          path: "/repo/main",
          head: undefined,
          branch: undefined,
          isDetached: false,
        },
      ],
    });
  });

  it("parses worktrees even when HEAD is missing", () => {
    const output = `worktree /repo/wt
branch refs/heads/feature/foo
`;

    expect(parseWorktreeListPorcelain(output)).toEqual({
      mainPath: "/repo/wt",
      worktrees: [
        {
          path: "/repo/wt",
          head: undefined,
          branch: "feature/foo",
          isDetached: false,
        },
      ],
    });
  });

  it("ignores lines before the first worktree block", () => {
    const output = `HEAD 1111111111111111111111111111111111111111
branch refs/heads/main

worktree /repo/main
HEAD 1111111111111111111111111111111111111111
branch refs/heads/main
`;

    expect(parseWorktreeListPorcelain(output)).toEqual({
      mainPath: "/repo/main",
      worktrees: [
        {
          path: "/repo/main",
          head: "1111111111111111111111111111111111111111",
          branch: "main",
          isDetached: false,
        },
      ],
    });
  });

  it("treats bare worktrees as non-detached with no branch", () => {
    const output = `worktree /repo/bare
bare
`;

    expect(parseWorktreeListPorcelain(output)).toEqual({
      mainPath: "/repo/bare",
      worktrees: [
        {
          path: "/repo/bare",
          head: undefined,
          branch: undefined,
          isDetached: false,
        },
      ],
    });
  });
});
