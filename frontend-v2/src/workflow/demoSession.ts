import { DEFAULT_SETTINGS, type TagMapping, type VerifySettings } from "../api/client";
import { FIXTURES } from "../report/fixtures";
import { allRowsConfirmed } from "./tagMap";
import type { StepId } from "./steps";

export const DEMO_FIXTURE_ID = "dropped_stop_different";

export type TargetSource = "none" | "uploaded" | "converted";

export type UploadedPair = {
  legacy: string;
  target: string;
};

export type SessionSeed = {
  legacyText: string;
  targetText: string;
  tagMap: TagMapping[];
  settings: VerifySettings;
  projectId: null;
  uploadResult: null;
  targetSource: TargetSource;
  convertAsked: false;
  convertAttempted: false;
  convertResult: null;
  liveReport: null;
  invalidLive: null;
  uploaded: null;
};

export type ContinueContext = {
  step: StepId;
  legacyText: string;
  targetSource: TargetSource;
  convertAttempted: boolean;
  tagMap: TagMapping[];
  settings: VerifySettings;
  projectId: string | null;
  mapConfirmed: boolean;
};

function copyRows(rows: TagMapping[]): TagMapping[] {
  return rows.map((row) => ({ ...row }));
}

export function demoFixture() {
  const fixture = FIXTURES.find((row) => row.id === DEMO_FIXTURE_ID);
  if (!fixture) {
    throw new Error("dropped_stop_different fixture is missing");
  }
  return fixture;
}

/** Blank shared session. Try it calls this, then applyDemo(). */
export function emptySession(): SessionSeed {
  return {
    legacyText: "",
    targetText: "",
    tagMap: [],
    settings: { ...DEFAULT_SETTINGS },
    projectId: null,
    uploadResult: null,
    targetSource: "none",
    convertAsked: false,
    convertAttempted: false,
    convertResult: null,
    liveReport: null,
    invalidLive: null,
    uploaded: null,
  };
}

/** Dropped-Stop conveyor pair into the same fields a manual session uses. */
export function applyDemo(): SessionSeed {
  const fixture = demoFixture();
  return {
    ...emptySession(),
    legacyText: fixture.legacyText,
    targetText: fixture.targetText,
    tagMap: copyRows(fixture.tagMap),
    targetSource: fixture.targetText.trim() === "" ? "none" : "uploaded",
  };
}

export function needsUpload(
  projectId: string | null,
  legacyText: string,
  targetText: string,
  uploaded: UploadedPair | null,
): boolean {
  if (projectId === null || uploaded === null) return true;
  return legacyText !== uploaded.legacy || targetText !== uploaded.target;
}

/** Keep confirmed / edited rows across a new POST /api/projects. */
export function tagMapAfterUpload(existing: TagMapping[]): TagMapping[] {
  return existing.length > 0 ? copyRows(existing) : [];
}

export function hasBlockingDiagnostics(result: {
  diagnostics: readonly unknown[];
  target_diagnostics: readonly unknown[];
}): boolean {
  return result.diagnostics.length > 0 || result.target_diagnostics.length > 0;
}

export function settingsAreValid(settings: VerifySettings): boolean {
  const { seed, scenarios, scans, dt_ms } = settings;
  if (![seed, scenarios, scans, dt_ms].every((n) => Number.isInteger(n))) return false;
  return scenarios > 0 && scans > 0 && dt_ms > 0;
}

export function primaryLabel(step: StepId): string {
  return step === "report" ? "Run comparison" : "Continue";
}

export function continueReason(ctx: ContinueContext): string | null {
  switch (ctx.step) {
    case "upload":
      return ctx.legacyText.trim() === "" ? "Original program is required." : null;
    case "convert":
      return ctx.targetSource === "none" && !ctx.convertAttempted
        ? "Upload a converted program or run convert first."
        : null;
    case "tagmap":
      return allRowsConfirmed(ctx.tagMap) ? null : "Confirm every name-map row.";
    case "verify":
    case "report":
      if (!settingsAreValid(ctx.settings)) {
        return "Settings must be whole numbers. Scenarios, scans, and dt_ms must be greater than 0.";
      }
      if (ctx.projectId === null) return "Upload a project first.";
      if (ctx.tagMap.length === 0) {
        return "No name-map rows. Convert or add rows, then confirm each one.";
      }
      if (!ctx.mapConfirmed) {
        const n = ctx.tagMap.filter((row) => row.evidence.startsWith("user-confirmed")).length;
        return `Confirm every name-map row before comparison (${n} of ${ctx.tagMap.length}).`;
      }
      return null;
  }
}
