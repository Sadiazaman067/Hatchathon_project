import type { Report } from "../types/report";

/** The target-side name for a legacy tag, only if the report's mapping_evidence says so. */
export function targetNameFor(report: Report, legacyTag: string): string | null {
  return report.mapping_evidence.find((m) => m.legacy_tag === legacyTag)?.target_tag ?? null;
}

/** Warnings start with a stable code, e.g. "UNSUPPORTED_OPCODE: line 3 ...". */
export function splitWarning(w: string): { code: string | null; message: string } {
  const m = /^([A-Z][A-Z0-9_]+):\s*([\s\S]*)$/.exec(w);
  return m ? { code: m[1], message: m[2] } : { code: null, message: w };
}
