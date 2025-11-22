import { describe, it, expect, vi } from "vitest";
import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import { directoryExists } from "./check-directory-exists.js";

vi.mock("node:fs/promises");

describe("directoryExists", () => {
  it("should return true for an existing directory", async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as Stats);

    const result = await directoryExists("/path/to/existing/dir");
    expect(result).toBe(true);
    expect(fs.stat).toHaveBeenCalledWith("/path/to/existing/dir");
  });

  it("should return false for a non-existent path", async () => {
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error("ENOENT"));

    const result = await directoryExists("/path/to/non-existent");
    expect(result).toBe(false);
  });

  it("should return false for a file (not a directory)", async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => false,
    } as Stats);

    const result = await directoryExists("/path/to/file.txt");
    expect(result).toBe(false);
  });
});
