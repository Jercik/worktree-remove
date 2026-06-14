import { describe, expect, it } from "vitest";
import { isPathEqualOrWithin } from "./is-path-equal-or-within.js";

describe("isPathEqualOrWithin", () => {
  it("returns true for the same POSIX path", () => {
    expect(
      isPathEqualOrWithin({
        basePath: "/Users/acme/repo-feature",
        candidatePath: "/Users/acme/repo-feature",
        platform: "linux",
      }),
    ).toBe(true);
  });

  it("returns true when the candidate path is inside the base path", () => {
    expect(
      isPathEqualOrWithin({
        basePath: "/Users/acme/repo-feature",
        candidatePath: "/Users/acme/repo-feature/src",
        platform: "linux",
      }),
    ).toBe(true);
  });

  it("returns false when the candidate path is outside the base path", () => {
    expect(
      isPathEqualOrWithin({
        basePath: "/Users/acme/repo-feature",
        candidatePath: "/Users/acme/repo-main",
        platform: "linux",
      }),
    ).not.toBe(true);
  });

  it("treats equal Windows paths case-insensitively", () => {
    expect(
      isPathEqualOrWithin({
        basePath: String.raw`C:\Users\Acme\Repo-Feature`,
        candidatePath: String.raw`c:\users\acme\repo-feature`,
        platform: "win32",
      }),
    ).toBe(true);
  });

  it("returns false for Windows paths on another drive", () => {
    expect(
      isPathEqualOrWithin({
        basePath: String.raw`C:\Users\Acme\Repo-Feature`,
        candidatePath: String.raw`D:\Users\Acme\Repo-Feature\src`,
        platform: "win32",
      }),
    ).not.toBe(true);
  });
});
