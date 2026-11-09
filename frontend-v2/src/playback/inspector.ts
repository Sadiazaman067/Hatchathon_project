import type { Bit, InputEvent, Report, TraceEntry, TraceWindow } from "../report/types";
import { eventsAtScan, heldInputs } from "./inputs";
import { scanCaption } from "./scrubber";

export interface DisagreeRow {
  tag: string;
  legacy: Bit;
  target: Bit;
}

export interface InspectorModel {
  scan: number;
  caption: string;
  inputsChanged: InputEvent[];
  outputsChangedLegacy: string[];
  outputsChangedTarget: string[];
  disagree: DisagreeRow[];
  held: Record<string, Bit>;
  legacyOutputs: Record<string, Bit> | null;
  targetOutputs: Record<string, Bit> | null;
}

function entryAt(series: TraceEntry[], scan: number): TraceEntry | undefined {
  return series.find((entry) => entry.scan === scan);
}

/** Observables that differ from the previous executed scan in this series. */
function outputsChanged(series: TraceEntry[], scan: number, window: TraceWindow): string[] {
  if (scan === 0 || scan === window.start_scan) return [];
  const current = entryAt(series, scan);
  const previous = entryAt(series, scan - 1);
  if (!current || !previous) return [];
  const tags = new Set([...Object.keys(previous.observables), ...Object.keys(current.observables)]);
  const changed: string[] = [];
  for (const tag of tags) {
    if (previous.observables[tag] !== current.observables[tag]) changed.push(tag);
  }
  changed.sort();
  return changed;
}

function disagreeAt(window: TraceWindow, scan: number): DisagreeRow[] {
  const legacy = entryAt(window.legacy, scan);
  const target = entryAt(window.target, scan);
  if (!legacy || !target) return [];
  const tags = new Set([...Object.keys(legacy.observables), ...Object.keys(target.observables)]);
  const rows: DisagreeRow[] = [];
  for (const tag of tags) {
    const l = legacy.observables[tag];
    const t = target.observables[tag];
    if (l !== t && (l === 0 || l === 1) && (t === 0 || t === 1)) {
      rows.push({ tag, legacy: l, target: t });
    }
  }
  rows.sort((a, b) => a.tag.localeCompare(b.tag));
  return rows;
}

/** Inspector rows from the Report (plus optional sample input events). */
export function inspectScan(
  report: Report,
  scan: number,
  inputEvents: InputEvent[] = report.counterexample,
): InspectorModel {
  const window = report.trace_window;
  const held = heldInputs(inputEvents, scan);
  if (!window || scan === 0) {
    return {
      scan,
      caption: scanCaption(scan),
      inputsChanged: eventsAtScan(inputEvents, scan),
      outputsChangedLegacy: [],
      outputsChangedTarget: [],
      disagree: [],
      held,
      legacyOutputs: null,
      targetOutputs: null,
    };
  }
  return {
    scan,
    caption: scanCaption(scan),
    inputsChanged: eventsAtScan(inputEvents, scan),
    outputsChangedLegacy: outputsChanged(window.legacy, scan, window),
    outputsChangedTarget: outputsChanged(window.target, scan, window),
    disagree: disagreeAt(window, scan),
    held,
    legacyOutputs: entryAt(window.legacy, scan)?.observables ?? null,
    targetOutputs: entryAt(window.target, scan)?.observables ?? null,
  };
}
