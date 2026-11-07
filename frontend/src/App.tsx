import { useState } from "react";
import { verifyProject, type TagMapping } from "./api/client";
import { SecondaryButton } from "./components/Buttons";
import DrawingSheet from "./components/DrawingSheet";
import StepRail from "./components/StepRail";
import TopBar from "./components/TopBar";
import ReportScreen from "./report/ReportScreen";
import type { Report } from "./report/types";
import ReplayScreen from "./screens/ReplayScreen";
import TagMapScreen from "./screens/TagMapScreen";
import UploadScreen from "./screens/UploadScreen";
import { EMPTY_FILES, type ProjectInfo, type UploadFiles } from "./state";

const UPLOAD = 0;
const TAG_MAP = 1;
const REPLAY = 2;
const REPORT = 3;

// Glues the four steps together: upload -> tag map -> replay -> report (CONTRACT.md section 9).
// The UI never decides a result: it shows the Report that /verify returns.
export default function App() {
  const [current, setCurrent] = useState(UPLOAD);
  const [furthest, setFurthest] = useState(UPLOAD);
  const [files, setFiles] = useState<UploadFiles>(EMPTY_FILES);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [rows, setRows] = useState<TagMapping[]>([]);
  const [confirmed, setConfirmed] = useState<boolean[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  function go(step: number) {
    setCurrent(step);
    setFurthest((f) => Math.max(f, step));
  }

  // A new upload starts a new project, so everything after it starts over.
  function onProjectReady(p: ProjectInfo, mapRows: TagMapping[]) {
    setProject(p);
    setRows(mapRows);
    setConfirmed(mapRows.map(() => false));
    setReport(null);
    setReplayError(null);
    setFurthest(TAG_MAP);
    setCurrent(TAG_MAP);
  }

  async function runReplay(confirmedRows: TagMapping[]) {
    if (!project) return;
    setReport(null);
    setReplayError(null);
    go(REPLAY);
    try {
      setReport(await verifyProject(project.id, confirmedRows, true));
      go(REPORT);
    } catch (e) {
      setReplayError(e instanceof Error ? e.message : String(e));
    }
  }

  function startOver() {
    setFiles(EMPTY_FILES);
    setProject(null);
    setRows([]);
    setConfirmed([]);
    setReport(null);
    setReplayError(null);
    setFurthest(UPLOAD);
    setCurrent(UPLOAD);
  }

  const confirmedCount = confirmed.filter(Boolean).length;
  const statusLines = [
    project ? `legacy rungs ${project.rungCount}` : undefined,
    rows.length > 0 ? `${confirmedCount} of ${rows.length} confirmed` : undefined,
    current === REPLAY && !replayError ? "running" : undefined,
    report ? report.status.replace(/_/g, " ") : undefined,
  ] as string[];

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8 md:flex-row md:gap-8">
        <aside className="md:w-[180px] md:shrink-0">
          <StepRail
            current={current}
            statusLines={statusLines}
            onSelect={(i) => {
              if (i <= furthest) setCurrent(i);
            }}
          />
        </aside>
        <main className="min-w-0 flex-1">
          <DrawingSheet>
            {current === UPLOAD && <UploadScreen files={files} setFiles={setFiles} onReady={onProjectReady} />}
            {current === TAG_MAP && project && (
              <TagMapScreen project={project} rows={rows} confirmed={confirmed} setConfirmed={setConfirmed} onRun={runReplay} />
            )}
            {current === REPLAY && <ReplayScreen error={replayError} onBack={() => setCurrent(TAG_MAP)} />}
            {current === REPORT && report && (
              <>
                <ReportScreen report={report} />
                <div className="mt-8 border-t border-hair pt-4">
                  <SecondaryButton onClick={startOver}>Start over</SecondaryButton>
                </div>
              </>
            )}
          </DrawingSheet>
        </main>
      </div>
    </div>
  );
}
