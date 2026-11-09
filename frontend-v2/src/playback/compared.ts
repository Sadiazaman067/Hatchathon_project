import type { Bit, Report, TraceEntry, TraceWindow } from "../report/types";
import { mapRoles } from "./roles";

function entryAt(series: TraceEntry[], scan: number): TraceEntry | undefined {
  return series.find((entry) => entry.scan === scan);
}

/** Tags the checker compared in this window (canonical names). First-difference tag first. */
export function comparedTags(window: TraceWindow, firstTag: string | null): string[] {
  const tags = new Set<string>();
  for (const entry of [...window.legacy, ...window.target]) {
    for (const tag of Object.keys(entry.observables)) tags.add(tag);
  }
  return [...tags].sort((a, b) => {
    if (a === firstTag) return -1;
    if (b === firstTag) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Output bit that drives the belt picture.
 * Prefer the first-difference tag (what the checker actually compared), else the motor role.
 */
export function comparedOutputTag(report: Report): string | null {
  const window = report.trace_window;
  const first = report.first_divergence?.tag ?? null;
  if (window && first) {
    const tags = comparedTags(window, first);
    if (tags.includes(first)) return first;
  }
  return mapRoles(report).motor;
}

export function bitAt(series: TraceEntry[], scan: number, tag: string | null): boolean {
  if (tag === null) return false;
  return entryAt(series, scan)?.observables[tag] === 1;
}

export function observablesAt(series: TraceEntry[], scan: number): Record<string, Bit> | null {
  const entry = entryAt(series, scan);
  return entry ? entry.observables : null;
}

export function disagreeOnScan(window: TraceWindow, scan: number): boolean {
  const legacy = entryAt(window.legacy, scan);
  const target = entryAt(window.target, scan);
  if (!legacy || !target) return false;
  const tags = new Set([...Object.keys(legacy.observables), ...Object.keys(target.observables)]);
  for (const tag of tags) {
    if (legacy.observables[tag] !== target.observables[tag]) return true;
  }
  return false;
}
