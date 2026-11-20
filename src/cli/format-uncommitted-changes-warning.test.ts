import { describe, expect, it } from "vitest";
import { formatUncommittedChangesWarning } from "./format-uncommitted-changes-warning.js";

describe("formatUncommittedChangesWarning", () => {
  it("returns no lines when every target is clean", () => {
    expect(
      formatUncommittedChangesWarning([
        { name: "app-login", uncommittedChanges: { state: "none" } },
        { name: "app-signup", uncommittedChanges: { state: "none" } },
      ]),
    ).toStrictEqual([]);
  });

  it("names every worktree with uncommitted changes on one line", () => {
    expect(
      formatUncommittedChangesWarning([
        { name: "app-login", uncommittedChanges: { state: "present" } },
        { name: "app-docs", uncommittedChanges: { state: "none" } },
        { name: "app-signup", uncommittedChanges: { state: "present" } },
      ]),
    ).toStrictEqual(["2 worktrees have uncommitted changes: app-login, app-signup"]);
  });

  it("warns about a worktree whose status could not be read, with the reason", () => {
    expect(
      formatUncommittedChangesWarning([
        { name: "app-login", uncommittedChanges: { state: "present" } },
        {
          name: "app-signup",
          uncommittedChanges: {
            state: "unknown",
            reason: "fatal: not a git repository: /missing/gitdir",
          },
        },
      ]),
    ).toStrictEqual([
      "1 worktree has uncommitted changes: app-login",
      "Could not check 'app-signup' for uncommitted changes: fatal: not a git repository: /missing/gitdir",
    ]);
  });
});
