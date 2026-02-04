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
});
