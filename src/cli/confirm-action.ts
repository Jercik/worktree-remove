import * as readline from "node:readline/promises";
import { exitInterrupted } from "./exit-interrupted.js";
import { exitWithMessage } from "../git/git-helpers.js";
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
  return askYesNo(message);
}

async function askYesNo(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  rl.on("SIGINT", exitInterrupted);

  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}
