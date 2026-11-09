import { describe, expect, it } from "vitest";
import { FIXTURES } from "../report/fixtures";
import {
  locateWarning,
  rungForTag,
  rungTokenDiff,
  warningSpans,
} from "./codeLocate";

function fixture(id: string) {
  const row = FIXTURES.find((item) => item.id === id);
  if (!row) throw new Error(id);
  return row;
}

describe("codeLocate", () => {
  it("parses the OSR warning to target line 1 column 46", () => {
    const loc = locateWarning(
      "UNSUPPORTED_OPCODE: target line 1: unsupported instruction 'OSR' at column 46",
    );
    expect(loc).toEqual({ side: "target", line: 1, column: 46, token: "OSR" });
    const sample = fixture("unsupported_osr_needs_review");
    const report = sample.data as { warnings: string[] };
    const spans = warningSpans(report.warnings);
    expect(spans[0]).toMatchObject({ side: "target", line: 1, column: 46, length: 3 });
    expect(sample.targetText.slice(45, 48)).toBe("OSR");
  });

  it("lists XIO Stop as missing from the converted dropped-Stop program", () => {
    const sample = fixture("dropped_stop_different");
    const diff = rungTokenDiff(sample.legacyText, sample.targetText, sample.tagMap);
    expect(diff.onlyLegacy).toHaveLength(1);
    expect(diff.onlyLegacy[0]?.op).toBe("XIO");
    expect(
      sample.tagMap.find((row) => row.legacy_tag === diff.onlyLegacy[0]?.operand)?.target_tag,
    ).toBe("Stop");
    expect(diff.onlyTarget).toEqual([]);
    expect(rungForTag(sample.targetText, "Motor")).toBe(1);
    expect(rungForTag(sample.legacyText, "O:2/0")).toBe(1);
  });

  it("finds no instruction mismatch on the matching sample", () => {
    const sample = fixture("match_no_difference");
    const diff = rungTokenDiff(sample.legacyText, sample.targetText, sample.tagMap);
    expect(diff.onlyLegacy).toEqual([]);
    expect(diff.onlyTarget).toEqual([]);
  });
});
