export type PlaybackMode = "presentation" | "fast";

/** Wall-clock wait per shown step in Presentation mode. Does not change dt_ms. */
export const PRESENTATION_STEP_MS = 1500;

/** Default scrubber index: first difference when that scan is in the clip. */
export function defaultPlayIndex(playable: number[], firstDifferenceScan: number | null): number {
  if (firstDifferenceScan === null) return 0;
  const index = playable.indexOf(firstDifferenceScan);
  return index >= 0 ? index : 0;
}

/**
 * Fast mode lands on the latest due shown step (may skip).
 * elapsedMs is wall time; dtMs is the report's scan period (unchanged).
 */
export function fastDueIndex(
  startIndex: number,
  elapsedMs: number,
  dtMs: number,
  lastIndex: number,
): number {
  const period = Math.max(1, dtMs);
  const steps = Math.floor(elapsedMs / period);
  return Math.min(lastIndex, Math.max(0, startIndex + steps));
}
