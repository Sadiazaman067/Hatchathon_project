import { ApiErrorBox, BusyLine } from "./ApiStatus";
import ReportView from "../ReportView";
import type { ApiError, TagMapping } from "../../api/client";
import type { Report } from "../../report/types";

type Props = {
  report: Report | null;
  invalidMessage: string | null;
  canFetch: boolean;
  busy: string | null;
  error: ApiError | null;
  onFetch: () => void;
  legacyText?: string;
  targetText?: string;
  tagMap?: TagMapping[];
};

export default function ReportStep({
  report,
  invalidMessage,
  canFetch,
  busy,
  error,
  onFetch,
  legacyText,
  targetText,
  tagMap,
}: Props) {
  return (
    <div className="flow-stack">
      <div className="action-row">
        <button type="button" className="ink-btn" disabled={!canFetch || !!busy} onClick={onFetch}>
          Fetch stored report
        </button>
      </div>
      <BusyLine label={busy} />
      <ApiErrorBox error={error} />
      {invalidMessage ? (
        <div className="invalid" role="alert">
          {invalidMessage}
        </div>
      ) : null}
      {report ? (
        <ReportView
          report={report}
          legacyText={legacyText}
          targetText={targetText}
          tagMap={tagMap}
        />
      ) : null}
      {!report && !invalidMessage && !error && !busy ? (
        <p className="footnote">No live report yet. Run verify, or fetch the last stored report.</p>
      ) : null}
    </div>
  );
}
