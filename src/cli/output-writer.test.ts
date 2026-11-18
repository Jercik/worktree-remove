import { afterEach, describe, expect, it, vi } from "vitest";
import { createOutputWriter } from "./output-writer.js";

const writeAll = (): string[] => {
  const lines: string[] = [];
  vi.spyOn(console, "error").mockImplementation((message: string) => {
    lines.push(message);
  });
  const output = createOutputWriter({ verbose: false, quiet: false, dryRun: false });
  output.notice("done");
  output.warn("careful");
  output.error("broken");
  return lines;
};

describe("createOutputWriter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("colours warnings and errors but not notices when FORCE_COLOR is set", () => {
    vi.stubEnv("FORCE_COLOR", "1");
    vi.stubEnv("NO_COLOR", undefined);

    expect(writeAll()).toStrictEqual([
      "done",
      "\u001B[33mcareful\u001B[39m",
      "\u001B[31mbroken\u001B[39m",
    ]);
  });

  it("writes plain text when NO_COLOR is set", () => {
    vi.stubEnv("FORCE_COLOR", undefined);
    vi.stubEnv("NO_COLOR", "1");

    expect(writeAll()).toStrictEqual(["done", "careful", "broken"]);
  });
});
