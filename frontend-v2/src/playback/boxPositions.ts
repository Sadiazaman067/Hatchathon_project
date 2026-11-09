import type { Bit, TraceEntry } from "../report/types";

/** Almost the end of the belt; the box does not wrap. */
export const FULL_BELT = 0.98;
/** Motor-on scans from the clip start that map to FULL_BELT. Extra on-scans pile. */
export const TRAVEL_ON_SCANS = 6;
export const STACK_MAX = 3;
export const FALL_AFTER = 3;

export interface BoxScene {
  along: number;
  stacked: number;
  fall: number;
}

function motorOnByScan(series: TraceEntry[], motorTag: string | null): Map<number, Bit> {
  const motorOn = new Map<number, Bit>();
  if (motorTag === null) return motorOn;
  for (const entry of series) {
    const bit = entry.observables[motorTag];
    if (bit === 0 || bit === 1) motorOn.set(entry.scan, bit);
  }
  return motorOn;
}

/** Motor-on counts in the known clip. Scan 0 is 0. Resets at start_scan. */
export function motorOnCountsForScrubber(
  playable: number[],
  startScan: number,
  endScan: number,
  series: TraceEntry[],
  motorTag: string | null,
): number[] {
  const motorOn = motorOnByScan(series, motorTag);
  const byScan = new Map<number, number>();
  byScan.set(0, 0);
  let pos = 0;
  for (let scan = startScan; scan <= endScan; scan += 1) {
    if (scan === startScan) pos = 0;
    if (motorOn.get(scan) === 1) pos += 1;
    byScan.set(scan, pos);
  }
  return playable.map((scan) => byScan.get(scan) ?? 0);
}

export function boxSceneFromCount(count: number, motorOn: boolean): BoxScene {
  if (count <= 0) return { along: 0, stacked: 0, fall: 0 };
  const along = Math.min(FULL_BELT, (count / TRAVEL_ON_SCANS) * FULL_BELT);
  const overflow = Math.max(0, count - TRAVEL_ON_SCANS);
  const atEnd = along >= FULL_BELT && motorOn;
  const stacked = atEnd ? Math.min(STACK_MAX, overflow) : 0;
  const fallExtra = Math.max(0, overflow - STACK_MAX);
  const fall = atEnd ? Math.min(1, fallExtra / FALL_AFTER) : 0;
  return { along, stacked, fall };
}

/**
 * Illustrative box place along the belt from motor-on counts in this clip.
 * Travel uses a fixed scan budget so a motor that stays on past the end can pile.
 */
export function boxScenesForBoth(
  playable: number[],
  startScan: number,
  endScan: number,
  legacy: TraceEntry[],
  target: TraceEntry[],
  motorTag: string | null,
): { original: BoxScene[]; converted: BoxScene[] } {
  const originalCounts = motorOnCountsForScrubber(playable, startScan, endScan, legacy, motorTag);
  const convertedCounts = motorOnCountsForScrubber(playable, startScan, endScan, target, motorTag);
  const motorLegacy = motorOnByScan(legacy, motorTag);
  const motorTarget = motorOnByScan(target, motorTag);
  return {
    original: playable.map((scan, i) =>
      boxSceneFromCount(originalCounts[i] ?? 0, motorLegacy.get(scan) === 1),
    ),
    converted: playable.map((scan, i) =>
      boxSceneFromCount(convertedCounts[i] ?? 0, motorTarget.get(scan) === 1),
    ),
  };
}

export function boxFractionsForBoth(
  playable: number[],
  startScan: number,
  endScan: number,
  legacy: TraceEntry[],
  target: TraceEntry[],
  motorTag: string | null,
): { original: number[]; converted: number[] } {
  const scenes = boxScenesForBoth(playable, startScan, endScan, legacy, target, motorTag);
  return {
    original: scenes.original.map((scene) => scene.along),
    converted: scenes.converted.map((scene) => scene.along),
  };
}
