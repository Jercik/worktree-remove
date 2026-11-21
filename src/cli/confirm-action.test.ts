import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmAction } from "./confirm-action.js";
import { installFakeTerminal } from "./fake-terminal.test.helper.js";
import { createRemovalPolicy } from "../removal/removal-policy.js";

describe("confirmAction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits with status 130 when Ctrl+C is pressed at the prompt", async () => {
    const terminal = installFakeTerminal();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockReturnValue(undefined as never);

    void confirmAction("Remove?", {
      policy: createRemovalPolicy({
        dryRun: false,
        assumeYes: false,
        force: false,
        allowPrompt: true,
      }),
      promptDisabledMessage: "Confirmation required.",
    });
    terminal.type("\u0003");

    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(130);
    });
    expect(consoleError).toHaveBeenCalledWith("\nInterrupted");
  });
});
