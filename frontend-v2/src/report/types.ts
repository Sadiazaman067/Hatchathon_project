/** CONTRACT.md §8 Report JSON. Field names must match the backend. */

export type Status = "different" | "needs_review" | "no_difference_observed";
export type Bit = 0 | 1;

export interface InputEvent {
  scan: number;
  tag: string;
  value: Bit;
}

export interface FirstDivergence {
  scan: number;
  tag: string;
  legacy: Bit;
  target: Bit;
  rung: number | null;
}

/** mapping_evidence has no `kind` field (CONTRACT §8). */
export interface MappingEvidence {
  legacy_tag: string;
  target_tag: string;
  rule: string;
}

export interface TraceEntry {
  scan: number;
  observables: Record<string, Bit>;
}

export interface TraceWindow {
  start_scan: number;
  end_scan: number;
  legacy: TraceEntry[];
  target: TraceEntry[];
}

export interface Report {
  status: Status;
  coverage: { scenarios: number; scans: number; seed: number };
  assumptions: { dt_ms: number; executed_scan_index: string; profiles: string[] };
  first_divergence: FirstDivergence | null;
  mapping_evidence: MappingEvidence[];
  counterexample: InputEvent[];
  rules_used: string[];
  warnings: string[];
  trace_window: TraceWindow | null;
}

/** Target name from mapping_evidence only; null if that legacy tag is not listed. */
export function targetName(report: Report, legacyTag: string): string | null {
  return report.mapping_evidence.find((m) => m.legacy_tag === legacyTag)?.target_tag ?? null;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
