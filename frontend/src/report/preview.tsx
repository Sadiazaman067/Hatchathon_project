// Preview page for the Report screen (report-preview.html). Does not touch App.tsx.
// Fixtures are real CLI reports, saved as JSON (see src/report/fixtures/README.md).
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-serif/400.css";
import "../index.css";

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import DrawingSheet from "../components/DrawingSheet";
import ReportScreen from "./ReportScreen";
import type { Report } from "./types";
import aiUnscaled from "./fixtures/ai_unscaled_different.json";
import sealIn from "./fixtures/seal_in_flipped_stop.json";
import aiOk from "./fixtures/ai_no_difference.json";
import swapped from "./fixtures/swapped_output_needs_review.json";

const FIXTURES: { id: string; label: string; report: Report }[] = [
  { id: "ai-unscaled", label: "AI conversion, unscaled preset", report: aiUnscaled as Report },
  { id: "seal-in", label: "Seal-in, flipped Stop", report: sealIn as Report },
  { id: "ai-ok", label: "AI conversion", report: aiOk as Report },
  { id: "swapped", label: "Swapped output tag", report: swapped as Report },
];

function Preview() {
  const fromHash = FIXTURES.findIndex((f) => `#${f.id}` === window.location.hash);
  const [index, setIndex] = useState(fromHash < 0 ? 0 : fromHash);
  const current = FIXTURES[index];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8">
      <nav aria-label="Report fixtures" className="flex flex-wrap items-center gap-2">
        <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Report preview</span>
        {FIXTURES.map((f, i) => (
          <button key={f.id} type="button" aria-pressed={i === index}
            onClick={() => { setIndex(i); window.location.hash = f.id; }}
            className={`cursor-pointer border border-ink px-3 py-1.5 text-[13px] transition-colors duration-[120ms] ${
              i === index ? "bg-ink text-sheet" : "bg-transparent text-ink"}`}>
            {f.label}
          </button>
        ))}
      </nav>
      <DrawingSheet>
        {/* key restarts the draw animation when switching */}
        <ReportScreen key={current.id} report={current.report} sample />
      </DrawingSheet>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
