import type { TagMapping } from "../api/client";

/** First few non-empty lines of a program, to show in mono under the file name. */
export function firstLines(text: string, count = 3): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, count);
}

export function countLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
}

/** Reads a tag_map.json (docs/interfaces.md "Fixture formats"). Throws an Error with a plain message. */
export function parseTagMap(text: string): TagMapping[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn’t valid JSON.");
  }
  if (!Array.isArray(data)) throw new Error("A tag map must be a list of rows.");
  return data.map((row, i) => {
    const r = row as Record<string, unknown>;
    for (const key of ["legacy_tag", "target_tag", "rule", "evidence"]) {
      if (typeof r?.[key] !== "string") throw new Error(`Row ${i + 1} is missing “${key}”.`);
    }
    if (r.kind !== "input" && r.kind !== "observable") {
      throw new Error(`Row ${i + 1}: kind must be “input” or “observable”.`);
    }
    return {
      legacy_tag: r.legacy_tag as string,
      target_tag: r.target_tag as string,
      kind: r.kind,
      rule: r.rule as string,
      // Loading a map never counts as confirming it: the user has to confirm each row.
      evidence: `proposed: ${r.rule as string}`,
    };
  });
}

/** Rows from /convert or a loaded map, with evidence reset to "proposed: <rule>". */
export function resetEvidence(rows: TagMapping[]): TagMapping[] {
  return rows.map((r) => ({ ...r, evidence: `proposed: ${r.rule}` }));
}

/** Evidence of a confirmed row: "user-confirmed · " + the original evidence. */
export function evidenceFor(row: TagMapping, confirmed: boolean): string {
  return confirmed ? `user-confirmed · ${row.evidence}` : row.evidence;
}
