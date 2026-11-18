import { styleText } from "node:util";

const red = (text: string): string => styleText("red", text, { stream: process.stderr });

export function writeError(message: string, label?: string): void {
  if (label === undefined) {
    console.error(red(message));
  } else {
    console.error(red(label), message);
  }
}
