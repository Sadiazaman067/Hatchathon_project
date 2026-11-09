import { describe, expect, it } from "vitest";
import { FIXTURES } from "../report/fixtures";
import { validateReport } from "../report/validate";
import { defaultPlayIndex, fastDueIndex, PRESENTATION_STEP_MS } from "./playhead";
import { playableScans, TIMELINE_ELLIPSIS } from "./scrubber";

function reportOf(id: string) {
  const fixture = FIXTURES.find((f) => f.id === id);
  const parsed = validateReport(fixture?.data);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.report;
}

describe("playhead", () => {
  it("defaults to the first difference, not scan 0", () => {
    const report = reportOf("dropped_stop_different");
    const window = report.trace_window;
    if (!window || !report.first_divergence) throw new Error("expected clip");
    const playable = playableScans(window);
    expect(playable[0]).toBe(0);
    expect(defaultPlayIndex(playable, report.first_divergence.scan)).toBe(
      playable.indexOf(21),
    );
    expect(defaultPlayIndex(playable, report.first_divergence.scan)).not.toBe(0);
  });

  it("matching clip starts at scan 0", () => {
    const report = reportOf("match_no_difference");
    const window = report.trace_window;
    if (!window) throw new Error("expected clip");
    expect(defaultPlayIndex(playableScans(window), null)).toBe(0);
  });

  it("lets Fast skip shown scans using dt_ms without changing that period", () => {
    expect(PRESENTATION_STEP_MS).toBe(1500);
    expect(fastDueIndex(0, 0, 10, 10)).toBe(0);
    expect(fastDueIndex(0, 25, 10, 10)).toBe(2);
    expect(fastDueIndex(0, 500, 10, 10)).toBe(10);
  });

  it("uses an ellipsis marker, not the word gap", () => {
    expect(TIMELINE_ELLIPSIS).toBe("…");
    expect(TIMELINE_ELLIPSIS.toLowerCase()).not.toContain("gap");
  });
});
