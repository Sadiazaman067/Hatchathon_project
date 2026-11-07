// The Report JSON from CONTRACT.md section 8, hand-mirrored. The UI only displays it.

export type Status = "different" | "needs_review" | "no_difference_observed";

export interface Coverage {
  scenarios: number;
  scans: number;
  seed: number;
}

export interface Assumptions {
  dt_ms: number;
  executed_scan_index: string;
  profiles: string[];
}

export interface Divergence {
  scan: number;
  tag: string;
  legacy: number;
  target: number;
  rung: number | null;
}

export interface MappingEvidence {
  legacy_tag: string;
  target_tag: string;
  rule: string;
}

export interface InputEvent {
  scan: number;
  tag: string;
  value: number;
}

export interface TraceEntry {
  scan: number;
  observables: Record<string, number>;
}

export interface TraceWindow {
  start_scan: number;
  end_scan: number;
  legacy: TraceEntry[];
  target: TraceEntry[];
}

export interface Report {
  status: Status;
  coverage: Coverage;
  assumptions: Assumptions;
  first_divergence: Divergence | null;
  mapping_evidence: MappingEvidence[];
  counterexample: InputEvent[];
  rules_used: string[];
  warnings: string[];
  trace_window: TraceWindow | null;
}

/** Target name for a legacy tag, from the report's own mapping_evidence; null if not listed. */
export function targetName(report: Report, legacyTag: string): string | null {
  return report.mapping_evidence.find((m) => m.legacy_tag === legacyTag)?.target_tag ?? null;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
