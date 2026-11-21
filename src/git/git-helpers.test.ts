import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { confirm } from "./git-helpers.js";

function fakeTerminal(): PassThrough {
  return Object.assign(new PassThrough(), {
    isTTY: true,
    columns: 80,
    setRawMode: () => {},
  });
}

describe("confirm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits with status 130 when Ctrl+C is pressed at the prompt", async () => {
    const stdin = fakeTerminal();
    vi.spyOn(process, "stdin", "get").mockReturnValue(stdin as unknown as typeof process.stdin);
    vi.spyOn(process, "stderr", "get").mockReturnValue(
      fakeTerminal() as unknown as typeof process.stderr,
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockReturnValue(undefined as never);

    void confirm("Remove?");
    stdin.write("\u0003");

    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(130);
    });
    expect(consoleError).toHaveBeenCalledWith("\nInterrupted");
  });
});
