import { useState } from "react";
import TopBar from "./components/TopBar";
import StepRail from "./components/StepRail";
import DrawingSheet from "./components/DrawingSheet";
import ReportScreen from "./pages/ReportScreen";
import { STEPS } from "./steps";
import type { Report } from "./types/report";
// The repo's sample_report.json (CONTRACT.md section 8 example), used until the API exists.
import sample from "../../sample_report.json";

const sampleReport = sample as unknown as Report;
const sampleNote = (sample as { _note?: string })._note;

const REPORT_STEP = 3;

// The step rail buttons only switch which placeholder or screen shows, for now.
export default function App() {
  const [current, setCurrent] = useState(REPORT_STEP);

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8 md:flex-row md:gap-8">
        <aside className="md:w-[180px] md:shrink-0">
          <StepRail current={current} onSelect={setCurrent} />
        </aside>
        <main className="min-w-0 flex-1">
          <DrawingSheet>
            {current === REPORT_STEP ? (
              <ReportScreen report={sampleReport} fromFixture fixtureNote={sampleNote} />
            ) : (
              <p className="m-0 font-mono text-[13px] text-muted">
                {STEPS[current].name} screen: built in a later step.
              </p>
            )}
          </DrawingSheet>
        </main>
      </div>
    </div>
  );
}
