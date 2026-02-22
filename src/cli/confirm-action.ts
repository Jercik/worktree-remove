import { confirm, exitWithMessage } from "../git/git-helpers.js";

type ConfirmActionOptions = {
  assumeYes: boolean;
  allowPrompt: boolean;
  dryRun: boolean;
  promptDisabledMessage: string;
};

export async function confirmAction(
  message: string,
  options: ConfirmActionOptions,
): Promise<boolean> {
  if (options.assumeYes || options.dryRun) return true;
  if (!options.allowPrompt) {
    exitWithMessage(options.promptDisabledMessage);
  }
  return confirm(message);
}
