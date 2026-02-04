import { describe, it, expect } from "vitest";
import { normalizeGitPath } from "./normalize-git-path.js";

describe("normalizeGitPath", () => {
  it("returns paths unchanged on non-windows platforms", () => {
    expect(normalizeGitPath("/c/Users/acme/repo", "darwin")).toBe(
      "/c/Users/acme/repo",
    );
  });

  it("converts MSYS drive paths to win32 paths", () => {
    expect(normalizeGitPath("/c/Users/acme/repo", "win32")).toBe(
      String.raw`C:\Users\acme\repo`,
    );
  });

  it("converts Cygwin drive paths to win32 paths", () => {
    expect(normalizeGitPath("/cygdrive/c/Users/acme/repo", "win32")).toBe(
      String.raw`C:\Users\acme\repo`,
    );
  });

  it("does not rewrite regular win32 drive paths", () => {
    expect(normalizeGitPath("C:/Users/acme/repo", "win32")).toBe(
      "C:/Users/acme/repo",
    );
  });
});
