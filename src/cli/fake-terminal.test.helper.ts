import { PassThrough } from "node:stream";
import { vi } from "vitest";

function createTerminalStream(): PassThrough {
  return Object.assign(new PassThrough(), {
    isTTY: true,
    columns: 80,
    rows: 24,
    setRawMode: () => {},
  });
}

export function installFakeTerminal(): { type: (keys: string) => void } {
  const stdin = createTerminalStream();
  vi.spyOn(process, "stdin", "get").mockReturnValue(stdin as unknown as typeof process.stdin);
  vi.spyOn(process, "stderr", "get").mockReturnValue(
    createTerminalStream() as unknown as typeof process.stderr,
  );
  return {
    type: (keys) => {
      stdin.write(keys);
    },
  };
}
