interface WorktreeLock {
  reason: string | undefined;
}

export interface WorktreeEntry {
  path: string;
  head: string | undefined;
  branch: string | undefined;
  isDetached: boolean;
  lock: WorktreeLock | undefined;
}
