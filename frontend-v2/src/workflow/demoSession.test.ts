import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../api/client";
import { FIXTURES } from "../report/fixtures";
import { allRowsConfirmed } from "./tagMap";
import {
  applyDemo,
  continueReason,
  emptySession,
  hasBlockingDiagnostics,
  needsUpload,
  primaryLabel,
  settingsAreValid,
  tagMapAfterUpload,
} from "./demoSession";

describe("demoSession", () => {
  it("prefills dropped-Stop texts and a confirmed tag map", () => {
    const demo = applyDemo();
    expect(demo.legacyText).toContain("XIO I:1/1");
    expect(demo.targetText).not.toMatch(/XIO\s+Stop/);
    expect(demo.targetText).toContain("OTE Motor");
    expect(demo.settings).toEqual(DEFAULT_SETTINGS);
    expect(demo.projectId).toBeNull();
    expect(demo.targetSource).toBe("uploaded");
    expect(allRowsConfirmed(demo.tagMap)).toBe(true);
    expect(demo.tagMap.some((row) => row.legacy_tag === "I:1/1" && row.target_tag === "Stop")).toBe(
      true,
    );
  });

  it("does not share tag-map objects with the fixture", () => {
    const demo = applyDemo();
    const fixture = FIXTURES.find((row) => row.id === "dropped_stop_different");
    demo.tagMap[0].target_tag = "edited";
    expect(fixture?.tagMap[0].target_tag).toBe("Start");
  });

  it("emptySession clears leftover demo texts and rows", () => {
    const cleared = { ...applyDemo(), ...emptySession() };
    expect(cleared.legacyText).toBe("");
    expect(cleared.targetText).toBe("");
    expect(cleared.tagMap).toEqual([]);
    expect(cleared.targetSource).toBe("none");
    expect(cleared.projectId).toBeNull();
  });

  it("keeps existing tag-map rows after upload", () => {
    const demo = applyDemo();
    const kept = tagMapAfterUpload(demo.tagMap);
    expect(kept).toEqual(demo.tagMap);
    kept[0].legacy_tag = "changed";
    expect(demo.tagMap[0].legacy_tag).toBe("I:1/0");
    expect(tagMapAfterUpload([])).toEqual([]);
  });

  it("re-uploads when there is no project or the texts changed", () => {
    const demo = applyDemo();
    const uploaded = { legacy: demo.legacyText, target: demo.targetText };
    expect(needsUpload(null, demo.legacyText, demo.targetText, uploaded)).toBe(true);
    expect(needsUpload("p1", demo.legacyText, demo.targetText, uploaded)).toBe(false);
    expect(needsUpload("p1", demo.legacyText + "\n", demo.targetText, uploaded)).toBe(true);
    expect(needsUpload("p1", demo.legacyText, demo.targetText, null)).toBe(true);
  });
});

describe("continue gates", () => {
  it("labels 01–04 Continue and 05 Run comparison", () => {
    expect(primaryLabel("upload")).toBe("Continue");
    expect(primaryLabel("convert")).toBe("Continue");
    expect(primaryLabel("tagmap")).toBe("Continue");
    expect(primaryLabel("verify")).toBe("Continue");
    expect(primaryLabel("report")).toBe("Run comparison");
  });

  it("blocks empty original on upload and unconfirmed rows on names", () => {
    const demo = applyDemo();
    expect(
      continueReason({
        step: "upload",
        legacyText: "",
        targetSource: "uploaded",
        convertAttempted: false,
        tagMap: demo.tagMap,
        settings: demo.settings,
        projectId: null,
        mapConfirmed: true,
      }),
    ).toBe("Original program is required.");
    expect(
      continueReason({
        step: "upload",
        legacyText: demo.legacyText,
        targetSource: "uploaded",
        convertAttempted: false,
        tagMap: demo.tagMap,
        settings: demo.settings,
        projectId: null,
        mapConfirmed: true,
      }),
    ).toBeNull();
    expect(
      continueReason({
        step: "convert",
        legacyText: demo.legacyText,
        targetSource: "uploaded",
        convertAttempted: false,
        tagMap: demo.tagMap,
        settings: demo.settings,
        projectId: "p1",
        mapConfirmed: true,
      }),
    ).toBeNull();
    expect(
      continueReason({
        step: "convert",
        legacyText: demo.legacyText,
        targetSource: "none",
        convertAttempted: false,
        tagMap: demo.tagMap,
        settings: demo.settings,
        projectId: "p1",
        mapConfirmed: true,
      }),
    ).toMatch(/convert/i);
    expect(
      continueReason({
        step: "tagmap",
        legacyText: demo.legacyText,
        targetSource: "uploaded",
        convertAttempted: false,
        tagMap: demo.tagMap.map((row) => ({ ...row, evidence: "proposed: INPUT_MAP_V1" })),
        settings: demo.settings,
        projectId: "p1",
        mapConfirmed: false,
      }),
    ).toBe("Confirm every name-map row.");
  });

  it("requires numeric settings and an uploaded confirmed map before comparison", () => {
    const demo = applyDemo();
    expect(settingsAreValid(demo.settings)).toBe(true);
    expect(settingsAreValid({ ...demo.settings, scenarios: 0 })).toBe(false);
    expect(settingsAreValid({ ...demo.settings, dt_ms: 10.5 })).toBe(false);
    expect(hasBlockingDiagnostics({ diagnostics: [], target_diagnostics: [] })).toBe(false);
    expect(hasBlockingDiagnostics({ diagnostics: [{}], target_diagnostics: [] })).toBe(true);
    expect(
      continueReason({
        step: "verify",
        legacyText: demo.legacyText,
        targetSource: "uploaded",
        convertAttempted: false,
        tagMap: demo.tagMap,
        settings: demo.settings,
        projectId: null,
        mapConfirmed: true,
      }),
    ).toBe("Upload a project first.");
    expect(
      continueReason({
        step: "report",
        legacyText: demo.legacyText,
        targetSource: "uploaded",
        convertAttempted: false,
        tagMap: demo.tagMap,
        settings: demo.settings,
        projectId: "p1",
        mapConfirmed: true,
      }),
    ).toBeNull();
  });
});
