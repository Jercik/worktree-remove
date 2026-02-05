export type OutputWriterOptions = {
  verbose: boolean;
  quiet: boolean;
  dryRun: boolean;
};

export type OutputWriter = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  isDryRun: boolean;
  isVerbose: boolean;
  isQuiet: boolean;
};

const writeError = (message: string) => {
  console.error(message);
};

export function createOutputWriter(options: OutputWriterOptions): OutputWriter {
  const shouldInfo = options.verbose || options.dryRun;
  const prefix = options.dryRun ? "DRY RUN: " : "";

  const info = (message: string) => {
    if (options.quiet) return;
    if (!shouldInfo) return;
    console.error(`${prefix}${message}`);
  };

  const warn = (message: string) => {
    if (options.quiet) return;
    console.error(message);
  };

  return {
    info,
    warn,
    error: writeError,
    isDryRun: options.dryRun,
    isVerbose: options.verbose,
    isQuiet: options.quiet,
  };
}
