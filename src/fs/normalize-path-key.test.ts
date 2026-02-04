import { describe, it, expect } from "vitest";
import { normalizePathKey } from "./normalize-path-key.js";

describe("normalizePathKey", () => {
  it("normalizes win32 path casing for stable comparisons", () => {
    expect(normalizePathKey("C:/Foo/Bar", "win32")).toBe(
      String.raw`c:\foo\bar`,
    );
    expect(normalizePathKey("c:/foo/bar", "win32")).toBe(
      String.raw`c:\foo\bar`,
    );
  });

  it("returns resolved paths on non-windows platforms", () => {
    expect(normalizePathKey("/tmp/foo", "darwin")).toBe("/tmp/foo");
  });
});
