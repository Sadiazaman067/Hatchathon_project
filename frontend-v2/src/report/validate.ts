import type {
  Bit,
  FirstDivergence,
  InputEvent,
  MappingEvidence,
  Report,
  Status,
  TraceEntry,
  TraceWindow,
} from "./types";

export type ValidationResult =
  | { ok: true; report: Report }
  | { ok: false; message: string };

const STATUSES: ReadonlySet<string> = new Set([
  "different",
  "needs_review",
  "no_difference_observed",
]);

class ReportShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportShapeError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectInt(path: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ReportShapeError(`${path} must be an integer`);
  }
  return value;
}

function expectString(path: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new ReportShapeError(`${path} must be a string`);
  }
  return value;
}

function expectBit(path: string, value: unknown): Bit {
  if (value !== 0 && value !== 1) {
    throw new ReportShapeError(`${path} must be 0 or 1`);
  }
  return value;
}

function expectStringArray(path: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ReportShapeError(`${path} must be an array of strings`);
  }
  return value.map((item, i) => expectString(`${path}[${i}]`, item));
}

function parseStatus(value: unknown): Status {
  if (typeof value !== "string" || !STATUSES.has(value)) {
    throw new ReportShapeError(
      `status must be exactly different, needs_review, or no_difference_observed`,
    );
  }
  return value as Status;
}

function parseDivergence(path: string, value: unknown): FirstDivergence {
  if (!isRecord(value)) {
    throw new ReportShapeError(`${path} must be an object`);
  }
  const rungRaw = value.rung;
  if (rungRaw !== null && (typeof rungRaw !== "number" || !Number.isInteger(rungRaw))) {
    throw new ReportShapeError(`${path}.rung must be an integer or null`);
  }
  return {
    scan: expectInt(`${path}.scan`, value.scan),
    tag: expectString(`${path}.tag`, value.tag),
    legacy: expectBit(`${path}.legacy`, value.legacy),
    target: expectBit(`${path}.target`, value.target),
    rung: rungRaw,
  };
}

function parseMapping(path: string, value: unknown): MappingEvidence {
  if (!isRecord(value)) {
    throw new ReportShapeError(`${path} must be an object`);
  }
  return {
    legacy_tag: expectString(`${path}.legacy_tag`, value.legacy_tag),
    target_tag: expectString(`${path}.target_tag`, value.target_tag),
    rule: expectString(`${path}.rule`, value.rule),
  };
}

function parseInputEvent(path: string, value: unknown): InputEvent {
  if (!isRecord(value)) {
    throw new ReportShapeError(`${path} must be an object`);
  }
  return {
    scan: expectInt(`${path}.scan`, value.scan),
    tag: expectString(`${path}.tag`, value.tag),
    value: expectBit(`${path}.value`, value.value),
  };
}

function parseTraceEntry(path: string, value: unknown): TraceEntry {
  if (!isRecord(value)) {
    throw new ReportShapeError(`${path} must be an object`);
  }
  if (!isRecord(value.observables)) {
    throw new ReportShapeError(`${path}.observables must be an object`);
  }
  const observables: Record<string, Bit> = {};
  for (const [key, bit] of Object.entries(value.observables)) {
    observables[key] = expectBit(`${path}.observables[${key}]`, bit);
  }
  return {
    scan: expectInt(`${path}.scan`, value.scan),
    observables,
  };
}

function parseTraceWindow(path: string, value: unknown): TraceWindow {
  if (!isRecord(value)) {
    throw new ReportShapeError(`${path} must be an object`);
  }
  const start_scan = expectInt(`${path}.start_scan`, value.start_scan);
  const end_scan = expectInt(`${path}.end_scan`, value.end_scan);
  if (end_scan < start_scan) {
    throw new ReportShapeError(`${path}.end_scan must be >= start_scan`);
  }
  if (!Array.isArray(value.legacy) || !Array.isArray(value.target)) {
    throw new ReportShapeError(`${path}.legacy and ${path}.target must be arrays`);
  }
  const legacy = value.legacy.map((entry, i) => parseTraceEntry(`${path}.legacy[${i}]`, entry));
  const target = value.target.map((entry, i) => parseTraceEntry(`${path}.target[${i}]`, entry));
  const expected = end_scan - start_scan + 1;
  if (legacy.length !== expected || target.length !== expected) {
    throw new ReportShapeError(
      `${path} must list every scan from start_scan to end_scan in both series`,
    );
  }
  for (let i = 0; i < expected; i += 1) {
    const scan = start_scan + i;
    const leg = legacy[i];
    const tgt = target[i];
    if (leg === undefined || tgt === undefined || leg.scan !== scan || tgt.scan !== scan) {
      throw new ReportShapeError(
        `${path} series must have identical scan numbers covering ${start_scan}…${end_scan}`,
      );
    }
  }
  return { start_scan, end_scan, legacy, target };
}

function parseReport(raw: unknown): Report {
  if (!isRecord(raw)) {
    throw new ReportShapeError("Report must be a JSON object");
  }
  const status = parseStatus(raw.status);
  if (!isRecord(raw.coverage)) {
    throw new ReportShapeError("coverage must be an object");
  }
  if (!isRecord(raw.assumptions)) {
    throw new ReportShapeError("assumptions must be an object");
  }
  if (!Array.isArray(raw.mapping_evidence)) {
    throw new ReportShapeError("mapping_evidence must be an array");
  }
  if (!Array.isArray(raw.counterexample)) {
    throw new ReportShapeError("counterexample must be an array");
  }

  const report: Report = {
    status,
    coverage: {
      scenarios: expectInt("coverage.scenarios", raw.coverage.scenarios),
      scans: expectInt("coverage.scans", raw.coverage.scans),
      seed: expectInt("coverage.seed", raw.coverage.seed),
    },
    assumptions: {
      dt_ms: expectInt("assumptions.dt_ms", raw.assumptions.dt_ms),
      executed_scan_index: expectString(
        "assumptions.executed_scan_index",
        raw.assumptions.executed_scan_index,
      ),
      profiles: expectStringArray("assumptions.profiles", raw.assumptions.profiles),
    },
    first_divergence:
      raw.first_divergence === null ? null : parseDivergence("first_divergence", raw.first_divergence),
    mapping_evidence: raw.mapping_evidence.map((row, i) => parseMapping(`mapping_evidence[${i}]`, row)),
    counterexample: raw.counterexample.map((row, i) => parseInputEvent(`counterexample[${i}]`, row)),
    rules_used: expectStringArray("rules_used", raw.rules_used),
    warnings: expectStringArray("warnings", raw.warnings),
    trace_window: raw.trace_window === null ? null : parseTraceWindow("trace_window", raw.trace_window),
  };

  if (status === "different") {
    if (report.first_divergence === null) {
      throw new ReportShapeError("first_divergence must be an object when status is different");
    }
    if (report.trace_window === null) {
      throw new ReportShapeError("trace_window must be an object when status is different");
    }
    const scan = report.first_divergence.scan;
    if (scan < report.trace_window.start_scan || scan > report.trace_window.end_scan) {
      throw new ReportShapeError("first_divergence.scan must lie inside trace_window");
    }
  } else if (status === "no_difference_observed") {
    if (report.first_divergence !== null) {
      throw new ReportShapeError("first_divergence must be null unless status is different");
    }
    if (report.trace_window === null) {
      throw new ReportShapeError("trace_window must be an object when status is no_difference_observed");
    }
  } else {
    if (report.first_divergence !== null) {
      throw new ReportShapeError("first_divergence must be null unless status is different");
    }
    if (report.trace_window !== null) {
      throw new ReportShapeError("trace_window must be null when status is needs_review");
    }
  }

  return report;
}

/** Runtime check of CONTRACT.md §8. Does not invent fields or a verdict. */
export function validateReport(raw: unknown): ValidationResult {
  try {
    return { ok: true, report: parseReport(raw) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report JSON shape is invalid";
    return { ok: false, message: `Invalid Report: ${message}` };
  }
}
