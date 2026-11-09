import type { TagMapping } from "../api/client";

export function isRowConfirmed(row: TagMapping): boolean {
  return row.evidence.startsWith("user-confirmed");
}

export function confirmEvidence(rule: string): string {
  return `user-confirmed · proposed: ${rule}`;
}

export function confirmRow(row: TagMapping): TagMapping {
  return { ...row, evidence: confirmEvidence(row.rule) };
}

export function allRowsConfirmed(rows: TagMapping[]): boolean {
  return rows.length > 0 && rows.every(isRowConfirmed);
}

export function blankRow(): TagMapping {
  return {
    legacy_tag: "",
    target_tag: "",
    kind: "input",
    rule: "",
    evidence: "",
  };
}
