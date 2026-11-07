import "./report.css";
import ReplayInputs from "./ReplayInputs";
import SignalTimeline from "./SignalTimeline";
import TitleBlock, { MappingEvidenceTable } from "./TitleBlock";
import VerdictBlock from "./VerdictBlock";
import type { Report } from "./types";

// 04 Report (DESIGN.md section 5). The version is chosen only by report.status;
// everything shown comes from the report. `sample` adds the SAMPLE DATA stamp.
export default function ReportScreen({ report, sample = false }: { report: Report; sample?: boolean }) {
  return (
    <div className="relative flex flex-col gap-8">
      {sample && (
        <span className="absolute right-0 top-0 border border-muted px-2 py-0.5 font-mono text-[11px] tracking-[0.12em] text-muted">
          SAMPLE DATA
        </span>
      )}
      {report.status === "different" && report.first_divergence ? (
        <DifferentReport report={report} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <VerdictBlock report={report} />
          <TitleBlock report={report} />
        </div>
      )}
    </div>
  );
}

function DifferentReport({ report }: { report: Report }) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-8">
        <VerdictBlock report={report} />
        <SignalTimeline report={report} />
      </div>
      <aside className="flex flex-col gap-7">
        <TitleBlock report={report} />
        <ReplayInputs report={report} />
        <MappingEvidenceTable report={report} />
      </aside>
    </div>
  );
}
