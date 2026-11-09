import { describe, expect, it } from "vitest";
import { FIXTURES } from "../report/fixtures";
import { validateReport } from "../report/validate";
import {
  FULL_BELT,
  TRAVEL_ON_SCANS,
  boxSceneFromCount,
  boxScenesForBoth,
  motorOnCountsForScrubber,
} from "./boxPositions";
import { bitAt, comparedOutputTag, disagreeOnScan } from "./compared";
import { defaultPlayIndex } from "./playhead";
import { playableScans } from "./scrubber";

function reportOf(id: string) {
  const fixture = FIXTURES.find((f) => f.id === id);
  const parsed = validateReport(fixture?.data);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.report;
}

describe("compared scan picture", () => {
  it("dropped Stop: original motor off and converted on at scan 21", () => {
    const report = reportOf("dropped_stop_different");
    const window = report.trace_window;
    const first = report.first_divergence;
    if (!window || !first) throw new Error("expected different report");
    expect(first.scan).toBe(21);
    expect(first.legacy).toBe(0);
    expect(first.target).toBe(1);
    expect(comparedOutputTag(report)).toBe("O:2/0");
    expect(bitAt(window.legacy, 21, "O:2/0")).toBe(false);
    expect(bitAt(window.target, 21, "O:2/0")).toBe(true);
    expect(disagreeOnScan(window, 20)).toBe(false);
    expect(disagreeOnScan(window, 21)).toBe(true);
    expect(defaultPlayIndex(playableScans(window), 21)).toBe(playableScans(window).indexOf(21));
  });

  it("matching sample has a clip and agreeing motors", () => {
    const report = reportOf("match_no_difference");
    const window = report.trace_window;
    if (!window) throw new Error("expected matching clip");
    expect(window.start_scan).toBe(1);
    expect(window.end_scan).toBe(30);
    expect(bitAt(window.legacy, 21, "O:2/0")).toBe(false);
    expect(bitAt(window.target, 21, "O:2/0")).toBe(false);
    expect(disagreeOnScan(window, 21)).toBe(false);
  });

  it("pile-up only after travel budget while the motor stays on", () => {
    expect(boxSceneFromCount(TRAVEL_ON_SCANS, true).along).toBeCloseTo(FULL_BELT);
    expect(boxSceneFromCount(TRAVEL_ON_SCANS, true).stacked).toBe(0);
    expect(boxSceneFromCount(TRAVEL_ON_SCANS + 2, true).stacked).toBe(2);
    expect(boxSceneFromCount(TRAVEL_ON_SCANS + 2, false).stacked).toBe(0);
    expect(boxSceneFromCount(TRAVEL_ON_SCANS + 6, true).fall).toBeGreaterThan(0);
  });

  it("converted dropped-Stop clip piles; original does not after Stop", () => {
    const report = reportOf("dropped_stop_different");
    const window = report.trace_window;
    const tag = comparedOutputTag(report);
    if (!window || !tag) throw new Error("expected window");
    const playable = playableScans(window);
    const scenes = boxScenesForBoth(
      playable,
      window.start_scan,
      window.end_scan,
      window.legacy,
      window.target,
      tag,
    );
    const atEnd = playable.length - 1;
    expect(scenes.converted[atEnd]?.along).toBeCloseTo(FULL_BELT);
    expect((scenes.converted[atEnd]?.stacked ?? 0) + (scenes.converted[atEnd]?.fall ?? 0)).toBeGreaterThan(
      0,
    );
    expect(scenes.original[atEnd]?.stacked).toBe(0);
    expect(scenes.original[atEnd]?.fall).toBe(0);
    const counts = motorOnCountsForScrubber(
      playable,
      window.start_scan,
      window.end_scan,
      window.target,
      tag,
    );
    expect(Math.max(...counts)).toBeGreaterThan(TRAVEL_ON_SCANS);
  });
});
