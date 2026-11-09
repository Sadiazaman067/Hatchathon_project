import { useMemo, useState } from "react";
import DrawingSheet from "./components/DrawingSheet";
import ExamplesView from "./components/home/ExamplesView";
import LandingView from "./components/LandingView";
import SessionView from "./components/home/SessionView";
import ReportView from "./components/ReportView";
import ConvertStep from "./components/workflow/ConvertStep";
import ReportStep from "./components/workflow/ReportStep";
import StepFooter from "./components/workflow/StepFooter";
import StepRail from "./components/workflow/StepRail";
import TagMapStep from "./components/workflow/TagMapStep";
import UploadStep from "./components/workflow/UploadStep";
import VerifyStep from "./components/workflow/VerifyStep";
import {
  ApiError,
  convertProject,
  createProject,
  DEFAULT_SETTINGS,
  getReport,
  verifyProject,
  type ConvertResponse,
  type CreateProjectResponse,
  type TagMapping,
  type VerifySettings,
} from "./api/client";
import { API_BASE } from "./env";
import { statusLabel } from "./playback/plainLanguage";
import { FIXTURES } from "./report/fixtures";
import type { Report } from "./report/types";
import { validateReport } from "./report/validate";
import {
  applyDemo,
  continueReason,
  hasBlockingDiagnostics,
  needsUpload,
  primaryLabel,
  tagMapAfterUpload,
  type SessionSeed,
  type TargetSource,
  type UploadedPair,
} from "./workflow/demoSession";
import { rememberSession, sessionEntry, type SessionRun } from "./workflow/session";
import { STEPS, type StepId } from "./workflow/steps";
import { allRowsConfirmed } from "./workflow/tagMap";

type Route = "landing" | "new" | "results" | "samples" | "past";
type ResultSource = "none" | "live" | "sample";

function asError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, String(error));
}

export default function App() {
  const [route, setRoute] = useState<Route>("landing");
  const [resultSource, setResultSource] = useState<ResultSource>("none");
  const [step, setStep] = useState<StepId>("upload");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [navMessage, setNavMessage] = useState<string | null>(null);

  const [legacyText, setLegacyText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [uploadResult, setUploadResult] = useState<CreateProjectResponse | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [targetSource, setTargetSource] = useState<TargetSource>("none");
  const [convertAsked, setConvertAsked] = useState(false);
  const [convertAttempted, setConvertAttempted] = useState(false);
  const [convertResult, setConvertResult] = useState<ConvertResponse | null>(null);
  const [tagMap, setTagMap] = useState<TagMapping[]>([]);
  const [settings, setSettings] = useState<VerifySettings>(DEFAULT_SETTINGS);
  const [liveReport, setLiveReport] = useState<Report | null>(null);
  const [invalidLive, setInvalidLive] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedPair | null>(null);
  const [sessionRuns, setSessionRuns] = useState<SessionRun[]>([]);
  const [fixtureId, setFixtureId] = useState(FIXTURES[0]?.id ?? "");
  const fixture = FIXTURES.find((f) => f.id === fixtureId) ?? FIXTURES[0];
  const fixtureParsed = useMemo(() => validateReport(fixture?.data), [fixture]);

  const mapConfirmed = allRowsConfirmed(tagMap);
  const canVerify = projectId !== null && mapConfirmed;
  const verifyBlocked =
    projectId === null
      ? "Upload a project first."
      : tagMap.length === 0
        ? "No name-map rows. Convert or add rows, then confirm each one."
        : mapConfirmed
          ? null
          : `Confirm every name-map row before comparison (${tagMap.filter((r) => r.evidence.startsWith("user-confirmed")).length} of ${tagMap.length}).`;

  const enabled: Record<StepId, boolean> = {
    upload: true,
    convert: projectId !== null,
    tagmap: projectId !== null && (targetSource !== "none" || convertAttempted),
    verify: canVerify,
    report: projectId !== null,
  };

  const done: Record<StepId, boolean> = {
    upload: projectId !== null,
    convert: convertAttempted || targetSource === "converted",
    tagmap: mapConfirmed,
    verify: liveReport !== null,
    report: liveReport !== null,
  };

  const statusLines: Record<StepId, string> = {
    upload: projectId
      ? `${uploadResult?.rung_count ?? 0} original rungs`
      : "not started",
    convert:
      targetSource === "converted"
        ? "converted"
        : convertAttempted
          ? "attempted"
          : targetSource === "uploaded"
            ? "optional"
            : "not started",
    tagmap: `${tagMap.filter((r) => r.evidence.startsWith("user-confirmed")).length} of ${tagMap.length} confirmed`,
    verify: liveReport ? statusLabel(liveReport.status) : "not started",
    report: liveReport ? statusLabel(liveReport.status) : "no report yet",
  };

  const gate = continueReason({
    step,
    legacyText,
    targetSource,
    convertAttempted,
    tagMap,
    settings,
    projectId,
    mapConfirmed,
  });

  async function run<T>(label: string, work: () => Promise<T>): Promise<T | null> {
    setBusy(label);
    setError(null);
    try {
      return await work();
    } catch (err) {
      setError(asError(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  function applySeed(seed: SessionSeed) {
    setLegacyText(seed.legacyText);
    setTargetText(seed.targetText);
    setTagMap(seed.tagMap);
    setSettings(seed.settings);
    setProjectId(seed.projectId);
    setUploadResult(seed.uploadResult);
    setTargetSource(seed.targetSource);
    setConvertAsked(seed.convertAsked);
    setConvertAttempted(seed.convertAttempted);
    setConvertResult(seed.convertResult);
    setLiveReport(seed.liveReport);
    setInvalidLive(seed.invalidLive);
    setUploaded(seed.uploaded);
    setError(null);
    setNavMessage(null);
  }

  function applyReport(raw: unknown, fromProjectId: string | null) {
    const parsed = validateReport(raw);
    if (!parsed.ok) {
      setLiveReport(null);
      setInvalidLive(parsed.message);
      return;
    }
    setInvalidLive(null);
    setLiveReport(parsed.report);
    setResultSource("live");
    setStep("report");
    setRoute("results");
    if (fromProjectId) {
      setSessionRuns((current) => rememberSession(current, sessionEntry(fromProjectId, parsed.report)));
    }
  }

  async function onUpload(): Promise<CreateProjectResponse | null> {
    const target = targetText.trim() === "" ? null : targetText;
    const created = await run("POST /api/projects", () => createProject(legacyText, target));
    if (!created) return null;
    setUploadResult(created);
    setProjectId(created.project_id);
    setTargetSource(target ? "uploaded" : "none");
    setConvertAsked(false);
    setConvertAttempted(false);
    setConvertResult(null);
    setTagMap((current) => tagMapAfterUpload(current));
    setLiveReport(null);
    setInvalidLive(null);
    setUploaded({ legacy: legacyText, target: targetText });
    return created;
  }

  async function ensureUploaded(): Promise<CreateProjectResponse | null> {
    if (!needsUpload(projectId, legacyText, targetText, uploaded)) {
      return uploadResult;
    }
    return onUpload();
  }

  async function onConvert() {
    if (!projectId) return;
    setConvertAsked(false);
    const converted = await run("POST /api/projects/{id}/convert", () => convertProject(projectId));
    if (!converted) return;
    setConvertAttempted(true);
    setConvertResult(converted);
    setTagMap(converted.tag_map);
    if (converted.unresolved.length === 0) {
      setTargetSource("converted");
    }
  }

  async function onVerify(id: string | null = projectId) {
    if (!id || !mapConfirmed) return;
    const raw = await run("POST /api/projects/{id}/verify", () =>
      verifyProject(id, tagMap, true, settings),
    );
    if (raw === null) return;
    applyReport(raw, id);
  }

  async function onFetchReport() {
    if (!projectId) return;
    const raw = await run("GET /api/projects/{id}/report", () => getReport(projectId));
    if (raw === null) return;
    applyReport(raw, projectId);
  }

  async function onOpenSession(id: string) {
    setProjectId(id);
    const raw = await run("GET /api/projects/{id}/report", () => getReport(id));
    if (raw === null) return;
    applyReport(raw, id);
  }

  function go(id: StepId) {
    if (!enabled[id]) return;
    setError(null);
    setNavMessage(null);
    setStep(id);
  }

  function enterApp() {
    applySeed(applyDemo());
    setResultSource("none");
    setRoute("new");
    setStep("upload");
  }

  function onBack() {
    const index = STEPS.findIndex((item) => item.id === step);
    if (index <= 0) return;
    setError(null);
    setNavMessage(null);
    setStep(STEPS[index - 1].id);
  }

  async function onPrimary() {
    setError(null);
    if (gate) {
      setNavMessage(gate);
      return;
    }
    setNavMessage(null);
    if (step === "upload") {
      const created = await ensureUploaded();
      if (!created) return;
      if (hasBlockingDiagnostics(created)) {
        setNavMessage("Fix parse diagnostics before continuing.");
        return;
      }
      setStep("convert");
      return;
    }
    if (step === "convert") {
      setConvertAsked(false);
      setStep("tagmap");
      return;
    }
    if (step === "tagmap") {
      setStep("verify");
      return;
    }
    if (step === "verify") {
      setStep("report");
      return;
    }
    const created = await ensureUploaded();
    if (!created) return;
    if (hasBlockingDiagnostics(created)) {
      setNavMessage("Fix parse diagnostics before continuing.");
      setStep("upload");
      return;
    }
    await onVerify(created.project_id);
  }

  const liveTargetText =
    targetSource === "converted" ? (convertResult?.converted_text ?? targetText) : targetText;

  const inApp = route !== "landing";

  return (
    <div className="page">
      <header className={`masthead${inApp ? "" : " landing-bar"}`}>
        <h1 className="wordmark">
          <button type="button" className="wordmark-home" onClick={() => setRoute("landing")}>
            <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                d="M6 2v20M18 2v20M6 6h12M6 12h12M6 18h12"
              />
            </svg>
            LadderProof
          </button>
        </h1>
        {inApp ? (
          <>
            <nav className="mode-row" aria-label="App sections">
              <button
                type="button"
                aria-pressed={route === "new"}
                onClick={() => {
                  setRoute("new");
                  setStep("upload");
                }}
              >
                New session
              </button>
              <button type="button" aria-pressed={route === "results"} onClick={() => setRoute("results")}>
                Results
              </button>
              <button type="button" aria-pressed={route === "samples"} onClick={() => setRoute("samples")}>
                Samples
              </button>
            </nav>
            <div className="mast-quiet">
              <button type="button" className="quiet-link" onClick={() => setRoute("past")}>
                Past runs{sessionRuns.length > 0 ? ` (${sessionRuns.length})` : ""}
              </button>
              <div className="api-meta">
                Engine {API_BASE === "" ? "/api → :8000 (proxy)" : API_BASE}
              </div>
            </div>
          </>
        ) : null}
      </header>

      {route === "landing" ? <LandingView onTry={enterApp} /> : null}

      {route === "samples" ? (
        <DrawingSheet>
          <ExamplesView
            onOpen={(id) => {
              setFixtureId(id);
              setResultSource("sample");
              setRoute("results");
            }}
          />
        </DrawingSheet>
      ) : null}

      {route === "past" ? (
        <DrawingSheet>
          <SessionView runs={sessionRuns} busy={busy} onOpen={(id) => void onOpenSession(id)} />
        </DrawingSheet>
      ) : null}

      {route === "results" ? (
        <DrawingSheet>
          {resultSource === "none" ? (
            <p className="idle-note">No result yet. Run a new session or open a sample.</p>
          ) : null}
          {resultSource === "sample" && fixture ? (
            <>
              <div className="stamp">Sample data</div>
              <button type="button" className="ink-btn back-examples" onClick={() => setRoute("samples")}>
                Back to samples
              </button>
              {fixtureParsed.ok ? (
                <div className="sample-report">
                  <ReportView
                    report={fixtureParsed.report}
                    inputEvents={fixture.inputs}
                    legacyText={fixture.legacyText}
                    targetText={fixture.targetText}
                    tagMap={fixture.tagMap}
                  />
                </div>
              ) : (
                <div className="invalid" role="alert">
                  {fixtureParsed.message}
                </div>
              )}
            </>
          ) : null}
          {resultSource === "live" ? (
            <ReportStep
              report={liveReport}
              invalidMessage={invalidLive}
              canFetch={projectId !== null}
              busy={busy}
              error={error}
              onFetch={() => void onFetchReport()}
              legacyText={legacyText}
              targetText={liveTargetText}
              tagMap={tagMap}
            />
          ) : null}
        </DrawingSheet>
      ) : null}

      {route === "new" ? (
        <div className="workspace">
          <StepRail
            current={step}
            enabled={enabled}
            done={done}
            statusLines={statusLines}
            onSelect={go}
          />
          <DrawingSheet>
            {step === "upload" ? (
              <UploadStep
                legacyText={legacyText}
                targetText={targetText}
                busy={busy}
                error={error}
                result={uploadResult}
                onLegacy={setLegacyText}
                onTarget={setTargetText}
                onSubmit={() => void onUpload()}
              />
            ) : null}
            {step === "convert" ? (
              <ConvertStep
                hasUploadedTarget={targetSource === "uploaded"}
                asking={convertAsked}
                busy={busy}
                error={error}
                result={convertResult}
                onAsk={() => setConvertAsked(true)}
                onCancelAsk={() => setConvertAsked(false)}
                onConvert={() => void onConvert()}
                onSkip={() => {
                  setConvertAsked(false);
                  setStep("tagmap");
                }}
              />
            ) : null}
            {step === "tagmap" ? (
              <TagMapStep
                rows={tagMap}
                lockTargetNames={targetSource === "converted"}
                onRows={setTagMap}
              />
            ) : null}
            {step === "verify" ? (
              <VerifyStep
                settings={settings}
                canVerify={canVerify}
                blockedReason={verifyBlocked}
                busy={busy}
                error={error}
                onSettings={setSettings}
                onVerify={() => void onVerify()}
              />
            ) : null}
            {step === "report" ? (
              <ReportStep
                report={liveReport}
                invalidMessage={invalidLive}
                canFetch={projectId !== null}
                busy={busy}
                error={error}
                onFetch={() => void onFetchReport()}
                legacyText={legacyText}
                targetText={liveTargetText}
                tagMap={tagMap}
              />
            ) : null}
          </DrawingSheet>
          {navMessage ? (
            <p className="idle-note" role="status">
              {navMessage}
            </p>
          ) : null}
          <StepFooter
            showBack={step !== "upload"}
            primaryLabel={primaryLabel(step)}
            primaryDisabled={gate !== null}
            busy={!!busy}
            onBack={onBack}
            onPrimary={() => void onPrimary()}
          />
        </div>
      ) : null}
    </div>
  );
}
