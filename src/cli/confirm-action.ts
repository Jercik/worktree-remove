import { confirm, exitWithMessage } from "../git/git-helpers.js";
import type { RemovalPolicy } from "../removal/removal-policy.js";

interface ConfirmActionOptions {
  policy: RemovalPolicy;
  promptDisabledMessage: string;
}

export async function confirmAction(
  message: string,
  options: ConfirmActionOptions,
): Promise<boolean> {
  if (options.policy.shouldAutoConfirm()) {
    return true;
  }
  if (!options.policy.allowPrompt) {
    exitWithMessage(options.promptDisabledMessage);
  }
  return confirm(message);
}
