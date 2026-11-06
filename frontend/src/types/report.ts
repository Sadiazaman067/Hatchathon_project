// Mirrors CONTRACT.md section 8 (Report JSON). Same key names and spellings as the backend.
export type Status = "different" | "no_difference_observed" | "needs_review";
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
