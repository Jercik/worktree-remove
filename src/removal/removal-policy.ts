export interface RemovalPolicy {
  dryRun: boolean;
  force: boolean;
  allowPrompt: boolean;
  shouldAutoConfirm: () => boolean;
  shouldWarnInsteadOfPrompt: () => boolean;
}

interface CreateRemovalPolicyInput {
  dryRun: boolean;
  assumeYes: boolean;
  force: boolean;
  allowPrompt: boolean;
}

export function createRemovalPolicy(input: CreateRemovalPolicyInput): RemovalPolicy {
  const autoConfirm = input.assumeYes || input.dryRun;

  return {
    dryRun: input.dryRun,
    force: input.force,
    allowPrompt: input.allowPrompt,
    shouldAutoConfirm: (): boolean => autoConfirm,
    shouldWarnInsteadOfPrompt: (): boolean => input.force || autoConfirm,
  };
}
