import { describe, expect, it } from "vitest";
import { FIXTURES } from "../report/fixtures";
import { validateReport } from "../report/validate";
import { inspectScan } from "./inspector";
import {
  convertedOutputChange,
  coverageStepsNote,
  detailsWarning,
  differenceSummary,
  everydayName,
  originalOutputChange,
  statusLabel,
  stepReadout,
  stepSentence,
} from "./plainLanguage";

function reportOf(id: string) {
  const fixture = FIXTURES.find((f) => f.id === id);
  const parsed = validateReport(fixture?.data);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.report;
}

describe("plain language from fixtures", () => {
  it("keeps internal statuses while using the approved labels", () => {
    expect(statusLabel("different")).toBe("Difference found");
    expect(statusLabel("no_difference_observed")).toBe("No difference observed");
    expect(statusLabel("needs_review")).toBe("Needs review");
  });

  it("describes dropped Stop from report fields", () => {
    const report = reportOf("dropped_stop_different");
    expect(everydayName(report, "O:2/0")).toBe("conveyor");
    expect(stepReadout(report)).toBe("Scan number 21 of 30");
    expect(differenceSummary(report)).toMatch(/when the stop button was pressed/i);
    expect(differenceSummary(report)).toMatch(/original program stopped/i);
    expect(differenceSummary(report)).toMatch(/kept it running/i);
    expect(differenceSummary(report)).toMatch(/scan 21/i);
  });

  it("does not invent a difference for matching or review", () => {
    const match = reportOf("match_no_difference");
    expect(match.coverage.scans).toBe(30);
    expect(stepReadout(match)).toBeNull();
    expect(coverageStepsNote(match)).toBe("30 scans in this test");
    const review = reportOf("unsupported_osr_needs_review");
    expect(review.first_divergence).toBeNull();
    expect(review.trace_window).toBeNull();
  });

  it("generates a scan sentence from the inspector model", () => {
    const fixture = FIXTURES.find((f) => f.id === "dropped_stop_different");
    const report = reportOf("dropped_stop_different");
    const start = stepSentence(report, inspectScan(report, 0, fixture?.inputs));
    expect(start).toMatch(/starting inputs/i);
    const atStop = stepSentence(report, inspectScan(report, 21, fixture?.inputs));
    expect(atStop).toMatch(/stop/i);
    expect(atStop).toMatch(/disagree/i);
    const model = inspectScan(report, 21, fixture?.inputs);
    expect(originalOutputChange(report, model)).toMatch(/turned off/i);
    expect(convertedOutputChange(report, model)).toBe("No change");
    expect(detailsWarning(report)).toMatch(/scan 21/i);
  });
});
