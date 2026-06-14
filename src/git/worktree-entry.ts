export interface WorktreeEntry {
  path: string;
  head: string | undefined;
  branch: string | undefined;
  isDetached: boolean;
}
