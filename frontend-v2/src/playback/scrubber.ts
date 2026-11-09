import type { TraceWindow } from "../report/types";

/**
 * Playable scans: 0 (input events), then start_scan…end_scan.
 * Does not invent scans in a gap (e.g. 1–15 when the window is 16–26).
 */
export function playableScans(window: TraceWindow): number[] {
  const scans: number[] = [0];
  for (let scan = window.start_scan; scan <= window.end_scan; scan += 1) {
    scans.push(scan);
  }
  return scans;
}

export function hasGapAfterZero(window: TraceWindow): boolean {
  return window.start_scan > 1;
}

export function gapLabel(window: TraceWindow): string {
  const lastMissing = window.start_scan - 1;
  if (lastMissing === 1) return "scan 1 not in this clip";
  return `scans 1–${lastMissing} not in this clip`;
}

/** Timeline marker for omitted scans. Not the word "gap". */
export const TIMELINE_ELLIPSIS = "…";

export function scanCaption(scan: number): string {
  if (scan === 0) return "Scan 0 · starting inputs";
  return `Scan ${scan}`;
}
