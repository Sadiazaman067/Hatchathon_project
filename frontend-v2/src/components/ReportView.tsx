import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConveyorViewport from "./ConveyorViewport";
import PlaybackBar from "./PlaybackBar";
import ScanInspector from "./ScanInspector";
import DetailsDrawer from "./report/DetailsDrawer";
import VerdictBlock from "./report/VerdictBlock";
import type { TagMapping } from "../api/client";
import { boxScenesForBoth } from "../playback/boxPositions";
import {
  diffSpans,
  rungForTag,
  warningSpans,
  type TokenSpan,
} from "../playback/codeLocate";
import { bitAt, comparedOutputTag, disagreeOnScan } from "../playback/compared";
import { bitOn, heldInputs } from "../playback/inputs";
import { everydayName } from "../playback/plainLanguage";
import { defaultPlayIndex, fastDueIndex, PRESENTATION_STEP_MS, type PlaybackMode } from "../playback/playhead";
import { mapRoles } from "../playback/roles";
import { playableScans, scanCaption } from "../playback/scrubber";
import { useReplayKeyboard } from "../playback/useReplayKeyboard";
import type { InputEvent, Report } from "../report/types";

const CodeView = lazy(() => import("./CodeView"));

export default function ReportView({
  report,
  inputEvents,
  legacyText = "",
  targetText = "",
  tagMap = [],
}: {
  report: Report;
  inputEvents?: InputEvent[];
  legacyText?: string;
  targetText?: string;
  tagMap?: TagMapping[];
}) {
  const events = inputEvents ?? report.counterexample;
  const replayOn = report.trace_window !== null;
  const traceWindow = report.trace_window;
  const playable = useMemo(() => (traceWindow ? playableScans(traceWindow) : []), [traceWindow]);
  const roles = useMemo(() => mapRoles(report), [report]);
  const outputTag = useMemo(() => comparedOutputTag(report), [report]);
  const landingIndex = useMemo(
    () => defaultPlayIndex(playable, report.first_divergence?.scan ?? null),
    [playable, report.first_divergence],
  );

  const [index, setIndex] = useState(landingIndex);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<PlaybackMode>("presentation");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    setIndex(landingIndex);
    setPlaying(false);
    setMode("presentation");
    setDetailsOpen(false);
    setCodeOpen(false);
  }, [report, landingIndex]);

  const lastIndex = Math.max(0, playable.length - 1);
  const onTogglePlay = useCallback(() => setPlaying((current) => !current), []);
  const onStep = useCallback(
    (delta: -1 | 1) => {
      setPlaying(false);
      setIndex((current) => Math.min(lastIndex, Math.max(0, current + delta)));
    },
    [lastIndex],
  );
  useReplayKeyboard({
    enabled: replayOn && !detailsOpen,
    length: playable.length,
    onTogglePlay,
    onStep,
  });

  useEffect(() => {
    if (!playing || !replayOn || playable.length === 0) return;
    if (mode === "presentation") {
      const id = globalThis.setInterval(() => {
        setIndex((current) => {
          if (current >= playable.length - 1) {
            setPlaying(false);
            return current;
          }
          return current + 1;
        });
      }, PRESENTATION_STEP_MS);
      return () => globalThis.clearInterval(id);
    }
    const dtMs = report.assumptions.dt_ms;
    const originIndex = indexRef.current;
    const originTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const due = fastDueIndex(originIndex, now - originTime, dtMs, lastIndex);
      setIndex(due);
      if (due >= lastIndex) {
        setPlaying(false);
        return;
      }
      raf = globalThis.requestAnimationFrame(tick);
    };
    raf = globalThis.requestAnimationFrame(tick);
    return () => globalThis.cancelAnimationFrame(raf);
  }, [playing, mode, replayOn, playable.length, lastIndex, report.assumptions.dt_ms]);

  const selectedScan = playable[index] ?? 0;
  const held = heldInputs(events, selectedScan);
  const startPressed = bitOn(held, roles.start);
  const stopPressed = bitOn(held, roles.stop);

  const boxScenes = useMemo(() => {
    if (!traceWindow) {
      return {
        original: [{ along: 0, stacked: 0, fall: 0 }],
        converted: [{ along: 0, stacked: 0, fall: 0 }],
      };
    }
    return boxScenesForBoth(
      playable,
      traceWindow.start_scan,
      traceWindow.end_scan,
      traceWindow.legacy,
      traceWindow.target,
      outputTag,
    );
  }, [traceWindow, playable, outputTag]);

  const motorLegacy = replayOn && traceWindow ? bitAt(traceWindow.legacy, selectedScan, outputTag) : false;
  const motorTarget = replayOn && traceWindow ? bitAt(traceWindow.target, selectedScan, outputTag) : false;
  const disagree = replayOn && traceWindow ? disagreeOnScan(traceWindow, selectedScan) : false;
  const outputName = outputTag ? everydayName(report, outputTag) : "compared output";
  const originalScene = boxScenes.original[index] ?? { along: 0, stacked: 0, fall: 0 };
  const convertedScene = boxScenes.converted[index] ?? { along: 0, stacked: 0, fall: 0 };

  const codeHint = useMemo(() => {
    if (!legacyText && !targetText) return null;
    if (report.status === "needs_review") {
      const spans = warningSpans(report.warnings);
      return {
        spans,
        caption: "LadderProof does not model this instruction, so it stopped instead of guessing.",
        locateFailed: spans.length === 0,
      };
    }
    if (report.status === "different" && report.first_divergence) {
      const tag = report.first_divergence.tag;
      const convertedTag = tagMap.find((row) => row.legacy_tag === tag)?.target_tag ?? tag;
      const legacyLine = report.first_divergence.rung ?? rungForTag(legacyText, tag);
      const targetLine = rungForTag(targetText, convertedTag);
      const spans: TokenSpan[] = diffSpans(legacyText, targetText, tagMap, legacyLine, targetLine);
      return {
        spans,
        caption:
          "Text hint: these instructions differ. The result above comes from running both programs, not from this text comparison.",
        locateFailed: legacyLine === null && targetLine === null,
      };
    }
    return null;
  }, [legacyText, targetText, tagMap, report]);

  return (
    <>
      <VerdictBlock report={report} onOpenDetails={() => setDetailsOpen(true)} />
      <DetailsDrawer
        report={report}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        legacyText={legacyText}
        targetText={targetText}
        inputs={events}
        tagMap={tagMap}
      />

      <div className="stage">
        <div className="replay-col">
          {replayOn && traceWindow ? (
            <p className="replay-caption">
              Both pictures show the same selected scan. The box moves while that motor is on.
              {report.status === "different"
                ? " This clip is the compared scans around the first difference."
                : " This clip is the first scans of the tested sequence."}
            </p>
          ) : null}

          <div className="scenes">
            <ConveyorViewport
              title="Original program"
              scanLabel={replayOn ? scanCaption(selectedScan) : "This test was not compared."}
              comparedName={outputName}
              disagree={disagree}
              visual={{
                idle: !replayOn,
                motorOn: motorLegacy,
                startPressed: replayOn ? startPressed : false,
                stopPressed: replayOn ? stopPressed : false,
                boxAlong: replayOn ? originalScene.along : 0,
                stacked: replayOn ? originalScene.stacked : 0,
                fall: replayOn ? originalScene.fall : 0,
                sliding: playing && replayOn && mode === "presentation",
              }}
            />
            <ConveyorViewport
              title="Converted program"
              scanLabel={replayOn ? scanCaption(selectedScan) : "This test was not compared."}
              comparedName={outputName}
              disagree={disagree}
              visual={{
                idle: !replayOn,
                motorOn: motorTarget,
                startPressed: replayOn ? startPressed : false,
                stopPressed: replayOn ? stopPressed : false,
                boxAlong: replayOn ? convertedScene.along : 0,
                stacked: replayOn ? convertedScene.stacked : 0,
                fall: replayOn ? convertedScene.fall : 0,
                sliding: playing && replayOn && mode === "presentation",
              }}
            />
          </div>

          {report.status === "needs_review" && codeHint ? (
            <div className="code-prompt">
              <button type="button" className="ink-btn primary" onClick={() => setCodeOpen(true)}>
                Show the code that needs review
              </button>
            </div>
          ) : null}

          <PlaybackBar
            enabled={replayOn}
            playable={playable}
            window={traceWindow}
            index={Math.min(index, Math.max(0, playable.length - 1))}
            playing={playing && replayOn}
            mode={mode}
            divergence={report.first_divergence}
            onIndex={setIndex}
            onPlaying={setPlaying}
            onMode={setMode}
            onShowCode={
              report.status === "different" && codeHint
                ? () => setCodeOpen(true)
                : undefined
            }
          />

          {codeOpen && codeHint ? (
            <Suspense fallback={<p className="footnote">Loading code view…</p>}>
              <CodeView
                original={legacyText}
                converted={targetText}
                spans={codeHint.spans}
                caption={codeHint.caption}
                locateFailed={codeHint.locateFailed}
              />
            </Suspense>
          ) : null}

          <ScanInspector report={report} scan={replayOn ? selectedScan : 0} inputEvents={events} />
        </div>
      </div>
    </>
  );
}
