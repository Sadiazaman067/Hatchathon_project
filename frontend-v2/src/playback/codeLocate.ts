export type Side = "legacy" | "target";

export interface WarningLocation {
  side: Side;
  line: number;
  column: number;
  token: string | null;
}

export interface RungToken {
  op: string;
  operand: string | null;
  column: number;
}

export interface TokenSpan {
  side: Side;
  line: number;
  column: number;
  length: number;
}

const SKIP = new Set(["SOR", "EOR", "BST", "NXB", "BND"]);
const OPS = new Set([
  "XIC",
  "XIO",
  "OTE",
  "OTL",
  "OTU",
  "TON",
  "TOF",
  "RTO",
  "OSR",
  "OSF",
  "GRT",
  "GEQ",
  "LES",
  "LEQ",
  "EQU",
  "NEQ",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse a checker warning such as "UNSUPPORTED_OPCODE: target line 1: ... 'OSR' at column 46". */
export function locateWarning(warning: string): WarningLocation | null {
  const sideMatch = /\b(legacy|target) line (\d+)\b/i.exec(warning);
  if (!sideMatch) return null;
  const side = sideMatch[1]?.toLowerCase() === "legacy" ? "legacy" : "target";
  const line = Number(sideMatch[2]);
  if (!Number.isInteger(line) || line < 1) return null;
  const tokenMatch = /instruction '([A-Z][A-Z0-9_]*)'/i.exec(warning);
  const columnMatch = /column (\d+)/i.exec(warning);
  const column = columnMatch ? Number(columnMatch[1]) : 1;
  return {
    side,
    line,
    column: Number.isInteger(column) && column >= 1 ? column : 1,
    token: tokenMatch?.[1] ?? null,
  };
}

export function warningSpans(warnings: string[]): TokenSpan[] {
  const spans: TokenSpan[] = [];
  for (const warning of warnings) {
    const loc = locateWarning(warning);
    if (!loc) continue;
    spans.push({
      side: loc.side,
      line: loc.line,
      column: loc.column,
      length: loc.token?.length ?? 1,
    });
  }
  return spans;
}

/** 1-based line whose OTE writes `tag`, or null if none or more than one. */
export function rungForTag(programText: string, tag: string): number | null {
  const lines = programText.split(/\r?\n/);
  const hits: number[] = [];
  const pattern = new RegExp(`\\bOTE\\s+${escapeRegExp(tag)}\\b`);
  lines.forEach((line, index) => {
    if (pattern.test(line)) hits.push(index + 1);
  });
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

export function tokenizeRung(line: string): RungToken[] {
  const tokens: RungToken[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null = pattern.exec(line);
  while (match) {
    const word = match[0];
    const column = match.index + 1;
    match = pattern.exec(line);
    if (SKIP.has(word)) continue;
    const next = match;
    if (OPS.has(word) && next && !SKIP.has(next[0]) && !OPS.has(next[0])) {
      tokens.push({ op: word, operand: next[0], column });
      match = pattern.exec(line);
      continue;
    }
    if (OPS.has(word)) {
      tokens.push({ op: word, operand: null, column });
    }
  }
  return tokens;
}

function remapOperand(
  operand: string | null,
  tagMap: { legacy_tag: string; target_tag: string }[],
): string | null {
  if (operand === null) return null;
  return tagMap.find((row) => row.legacy_tag === operand)?.target_tag ?? operand;
}

function keyOf(token: RungToken, mappedOperand: string | null): string {
  return mappedOperand ? `${token.op} ${mappedOperand}` : token.op;
}

/**
 * Instructions present on one side but not the other after renaming original
 * addresses to converted names. This is a text hint, not a verdict.
 */
export function rungTokenDiff(
  legacyLine: string,
  targetLine: string,
  tagMap: { legacy_tag: string; target_tag: string }[],
): { onlyLegacy: RungToken[]; onlyTarget: RungToken[] } {
  const legacyTokens = tokenizeRung(legacyLine);
  const targetTokens = tokenizeRung(targetLine);
  const targetKeys = new Set(targetTokens.map((token) => keyOf(token, token.operand)));
  const legacyKeys = new Set(
    legacyTokens.map((token) => keyOf(token, remapOperand(token.operand, tagMap))),
  );
  const onlyLegacy = legacyTokens.filter(
    (token) => !targetKeys.has(keyOf(token, remapOperand(token.operand, tagMap))),
  );
  const onlyTarget = targetTokens.filter((token) => !legacyKeys.has(keyOf(token, token.operand)));
  return { onlyLegacy, onlyTarget };
}

export function lineAt(programText: string, line: number): string {
  return programText.split(/\r?\n/)[line - 1] ?? "";
}

export function diffSpans(
  legacyText: string,
  targetText: string,
  tagMap: { legacy_tag: string; target_tag: string }[],
  legacyLine: number | null,
  targetLine: number | null,
): TokenSpan[] {
  if (legacyLine === null || targetLine === null) return [];
  const diff = rungTokenDiff(lineAt(legacyText, legacyLine), lineAt(targetText, targetLine), tagMap);
  const spans: TokenSpan[] = [];
  for (const token of diff.onlyLegacy) {
    const length = token.operand ? token.op.length + 1 + token.operand.length : token.op.length;
    spans.push({ side: "legacy", line: legacyLine, column: token.column, length });
  }
  for (const token of diff.onlyTarget) {
    const length = token.operand ? token.op.length + 1 + token.operand.length : token.op.length;
    spans.push({ side: "target", line: targetLine, column: token.column, length });
  }
  return spans;
}
