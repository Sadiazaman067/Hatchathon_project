import type { Report } from "../report/types";

export interface Roles {
  /** Canonical/legacy tag used in traces and counterexample. */
  motor: string | null;
  start: string | null;
  stop: string | null;
}

function norm(name: string): string {
  return name.trim().toLowerCase();
}

function namedRole(name: string): "motor" | "start" | "stop" | null {
  const n = norm(name);
  if (n === "motor" || n === "conveyor_motor") return "motor";
  if (n === "start" || n === "start_pb") return "start";
  if (n === "stop" || n === "stop_pb") return "stop";
  return null;
}

/**
 * Role mapping for conveyor visuals (not a verdict).
 * Prefer mapping_evidence target_tag, then legacy_tag:
 *   Motor / Conveyor_Motor → motor
 *   Start / Start_PB → start
 *   Stop / Stop_PB → stop
 * If names miss: first remaining trace-window observable → motor;
 * first two remaining counterexample (or leftover mapping) tags → start, then stop.
 */
export function mapRoles(report: Report): Roles {
  const observableTags: string[] = [];
  const seenObs = new Set<string>();
  const window = report.trace_window;
  if (window) {
    for (const entry of [...window.legacy, ...window.target]) {
      for (const tag of Object.keys(entry.observables)) {
        if (!seenObs.has(tag)) {
          seenObs.add(tag);
          observableTags.push(tag);
        }
      }
    }
  }

  const inputTags: string[] = [];
  const seenIn = new Set<string>();
  for (const event of report.counterexample) {
    if (!seenIn.has(event.tag)) {
      seenIn.add(event.tag);
      inputTags.push(event.tag);
    }
  }

  let motor: string | null = null;
  let start: string | null = null;
  let stop: string | null = null;
  const used = new Set<string>();

  for (const row of report.mapping_evidence) {
    const role = namedRole(row.target_tag) ?? namedRole(row.legacy_tag);
    if (role === "motor" && motor === null) {
      motor = row.legacy_tag;
      used.add(row.legacy_tag);
    } else if (role === "start" && start === null) {
      start = row.legacy_tag;
      used.add(row.legacy_tag);
    } else if (role === "stop" && stop === null) {
      stop = row.legacy_tag;
      used.add(row.legacy_tag);
    }
  }

  const remainingObs: string[] = [];
  for (const row of report.mapping_evidence) {
    if (seenObs.has(row.legacy_tag) && !used.has(row.legacy_tag) && !remainingObs.includes(row.legacy_tag)) {
      remainingObs.push(row.legacy_tag);
    }
  }
  for (const tag of observableTags) {
    if (!used.has(tag) && !remainingObs.includes(tag)) remainingObs.push(tag);
  }
  if (motor === null && remainingObs[0] !== undefined) {
    motor = remainingObs[0];
    used.add(motor);
  }

  const remainingIn: string[] = [];
  for (const row of report.mapping_evidence) {
    const tag = row.legacy_tag;
    if (used.has(tag) || remainingIn.includes(tag) || seenObs.has(tag)) continue;
    remainingIn.push(tag);
  }
  for (const tag of inputTags) {
    if (!used.has(tag) && !remainingIn.includes(tag)) remainingIn.push(tag);
  }
  for (const tag of remainingIn) {
    if (start === null) {
      start = tag;
      used.add(tag);
      continue;
    }
    if (stop === null) {
      stop = tag;
      used.add(tag);
      break;
    }
  }

  return { motor, start, stop };
}

export function targetLabel(report: Report, legacyTag: string): string {
  const row = report.mapping_evidence.find((m) => m.legacy_tag === legacyTag);
  if (!row) return legacyTag;
  return `${legacyTag} → ${row.target_tag}`;
}
