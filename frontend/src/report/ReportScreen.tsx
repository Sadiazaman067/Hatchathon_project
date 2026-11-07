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
      ) : report.status === "no_difference_observed" ? (
        <NoDifferenceReport report={report} />
      ) : (
        <NeedsReviewReport report={report} />
      )}
    </div>
  );
}

/** "CODE: message" -> code in mono, then the message. Warnings without a code show whole. */
function splitWarning(warning: string): [string | null, string] {
  const match = /^([A-Z][A-Z0-9_]+): (.*)$/s.exec(warning);
  return match ? [match[1], match[2]] : [null, warning];
}

function NeedsReviewReport({ report }: { report: Report }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-8">
        <VerdictBlock report={report} />
        <section aria-labelledby="review-items" className="flex flex-col gap-2">
          <h2 id="review-items" className="m-0 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
            What needs review · {report.warnings.length}
          </h2>
          {report.warnings.length === 0 ? (
            <p className="m-0 font-mono text-[13px] text-muted">No warnings were given: not available.</p>
          ) : (
            <ul className="m-0 list-none border border-amber p-0">
              {report.warnings.map((w, i) => {
                const [code, message] = splitWarning(w);
                return (
                  <li key={i} className="flex flex-col gap-1 border-b border-hair bg-amber-tint px-4 py-3 last:border-b-0">
                    {code && <span className="font-mono text-[13px] font-semibold text-amber-text">{code}</span>}
                    <span className="font-mono text-[14px]">{message}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <aside className="flex flex-col gap-7">
        <TitleBlock report={report} />
        <MappingEvidenceTable report={report} />
      </aside>
    </div>
  );
}

function NoDifferenceReport({ report }: { report: Report }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-8">
        <VerdictBlock report={report} />
        <MappingEvidenceTable report={report} />
      </div>
      <aside className="flex flex-col gap-7">
        <TitleBlock report={report} />
      </aside>
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
