export function exitInterrupted(): never {
  console.error("\nInterrupted");
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(130);
}
