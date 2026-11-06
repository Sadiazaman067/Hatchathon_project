import MappingEvidence from "../components/report/MappingEvidence";
import ReplayInputs from "../components/report/ReplayInputs";
import SignalTimeline from "../components/report/SignalTimeline";
import TitleBlock from "../components/report/TitleBlock";
import VerdictBlock from "../components/report/VerdictBlock";
import type { Report } from "../types/report";

type Props = {
  report: Report;
  /** True when the report comes from sample_report.json and not from a real verify() run. */
  fromFixture: boolean;
  fixtureNote?: string;
};

// The screen is chosen only by report.status (DESIGN.md section 5, screen 04).
export default function ReportScreen({ report, fromFixture, fixtureNote }: Props) {
  if (report.status !== "different") {
    return (
      <p className="m-0 font-mono text-[13px] text-muted">
        The {report.status} version of the Report screen is built in a later step.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <VerdictBlock report={report} fromFixture={fromFixture} />
          <SignalTimeline report={report} />
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          <TitleBlock report={report} />
          <ReplayInputs events={report.counterexample} />
          <MappingEvidence rows={report.mapping_evidence} />
        </div>
      </div>
      {fromFixture && fixtureNote && (
        <p className="m-0 mt-8 border-t border-hair pt-3 font-mono text-[12px] text-muted">
          SAMPLE DATA · {fixtureNote}
        </p>
      )}
    </div>
  );
}
